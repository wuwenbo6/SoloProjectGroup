export interface AlbumInfo {
  id: string;
  title: string;
  artist: string;
  year?: number;
  genre?: string;
  coverArt?: string;
  label?: string;
  country?: string;
  style?: string;
  barcode?: string;
  discogsId?: string;
  musicbrainzId?: string;
}

export interface TrackInfo {
  id: string;
  title: string;
  artist: string;
  album: string;
  trackNumber?: number;
  duration?: number;
  isrc?: string;
  year?: number;
  genre?: string;
}

export interface FingerprintResult {
  recordingId?: string;
  releaseId?: string;
  score: number;
}

export interface MetadataSearchQuery {
  title?: string;
  artist?: string;
  album?: string;
  trackNumber?: number;
  duration?: number;
}

export interface SearchResult {
  type: 'album' | 'track';
  score: number;
  data: AlbumInfo | TrackInfo;
}

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
const ACOUSTID_API = 'https://api.acoustid.org/v2';
const DISCOGS_API = 'https://api.discogs.com';

const ACOUSTID_CLIENT_KEY = 'z8p4b3v7';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function computeFingerprint(
  samples: Float32Array,
  sampleRate: number,
  duration?: number
): { fingerprint: string; length: number } {
  const actualDuration = duration || samples.length / sampleRate;
  const targetSamples = Math.floor(actualDuration * sampleRate);
  const audio = samples.slice(0, targetSamples);
  
  const frameSize = 1024;
  const hopSize = 256;
  const numFrames = Math.floor((audio.length - frameSize) / hopSize);
  
  const chroma: number[][] = [];
  const freqs = 12;
  
  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    const frame = audio.slice(start, start + frameSize);
    
    for (let j = 0; j < frameSize; j++) {
      const t = j / (frameSize - 1);
      const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * t);
      frame[j] *= window;
    }
    
    const bandEnergies = new Array(freqs).fill(0);
    for (let b = 0; b < freqs; b++) {
      const startFreq = 110 * Math.pow(2, b / 12);
      const endFreq = 110 * Math.pow(2, (b + 1) / 12);
      const startBin = Math.floor(startFreq * frameSize / sampleRate);
      const endBin = Math.floor(endFreq * frameSize / sampleRate);
      
      let energy = 0;
      for (let k = startBin; k < endBin && k < frameSize / 2; k++) {
        const re = frame[k * 2] || 0;
        const im = frame[k * 2 + 1] || 0;
        energy += re * re + im * im;
      }
      bandEnergies[b] = Math.log(energy + 1e-10);
    }
    
    chroma.push(bandEnergies);
  }
  
  const features: number[] = [];
  for (let i = 0; i < chroma.length; i++) {
    let max = -Infinity;
    let min = Infinity;
    for (let j = 0; j < freqs; j++) {
      max = Math.max(max, chroma[i][j]);
      min = Math.min(min, chroma[i][j]);
    }
    const range = max - min || 1;
    for (let j = 0; j < freqs; j++) {
      features.push(Math.floor(((chroma[i][j] - min) / range) * 255));
    }
  }
  
  let fingerprint = '';
  for (let i = 0; i < Math.min(features.length, 4096); i++) {
    fingerprint += String.fromCharCode(features[i]);
  }
  
  return {
    fingerprint: btoa(fingerprint),
    length: Math.floor(actualDuration)
  };
}

export async function identifyByFingerprint(
  fingerprint: string,
  duration: number
): Promise<FingerprintResult | null> {
  try {
    const params = new URLSearchParams({
      format: 'json',
      client: ACOUSTID_CLIENT_KEY,
      fingerprint: fingerprint,
      duration: duration.toString(),
      meta: 'recordings releaseids'
    });
    
    const response = await fetch(`${ACOUSTID_API}/lookup?${params}`);
    
    if (!response.ok) {
      throw new Error(`AcoustID API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const best = data.results[0];
      return {
        recordingId: best.id,
        releaseId: best.releasegroups?.[0]?.id,
        score: best.score || 0
      };
    }
    
    return null;
  } catch (error) {
    console.warn('Fingerprint identification failed:', error);
    return null;
  }
}

export async function searchMusicBrainz(
  query: MetadataSearchQuery,
  type: 'recording' | 'release' = 'recording'
): Promise<SearchResult[]> {
  try {
    const parts: string[] = [];
    
    if (query.title) parts.push(`"${encodeURIComponent(query.title)}"`);
    if (query.artist) parts.push(`artist:"${encodeURIComponent(query.artist)}"`);
    if (query.album) parts.push(`release:"${encodeURIComponent(query.album)}"`);
    if (query.duration) parts.push(`dur:${Math.floor(query.duration)}`);
    
    const searchQuery = parts.join(' AND ') || '*';
    const endpoint = type === 'recording' ? 'recording' : 'release';
    
    const url = `${MUSICBRAINZ_API}/${endpoint}?query=${encodeURIComponent(searchQuery)}&fmt=json&limit=10`;
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'VinylAudioProcessor/1.0 ( https://github.com/example )' }
    });
    
    if (!response.ok) {
      throw new Error(`MusicBrainz API error: ${response.status}`);
    }
    
    const data = await response.json();
    const results: SearchResult[] = [];
    
    if (type === 'recording' && data.recordings) {
      for (const recording of data.recordings) {
        results.push({
          type: 'track',
          score: recording.score || 0,
          data: {
            id: recording.id,
            title: recording.title,
            artist: recording['artist-credit']?.[0]?.name || 'Unknown',
            album: recording.releases?.[0]?.title || '',
            trackNumber: recording.releases?.[0]?.['release-events']?.[0]?.position,
            duration: recording.length ? recording.length / 1000 : undefined,
            year: recording.releases?.[0]?.date ? parseInt(recording.releases[0].date.split('-')[0]) : undefined
          }
        });
      }
    } else if (type === 'release' && data.releases) {
      for (const release of data.releases) {
        results.push({
          type: 'album',
          score: release.score || 0,
          data: {
            id: release.id,
            title: release.title,
            artist: release['artist-credit']?.[0]?.name || 'Unknown',
            year: release.date ? parseInt(release.date.split('-')[0]) : undefined,
            country: release.country,
            label: release['label-info']?.[0]?.label?.name,
            musicbrainzId: release.id
          }
        });
      }
    }
    
    await sleep(1000);
    return results;
  } catch (error) {
    console.warn('MusicBrainz search failed:', error);
    return [];
  }
}

export async function searchDiscogs(
  query: MetadataSearchQuery
): Promise<SearchResult[]> {
  try {
    const params = new URLSearchParams();
    if (query.title) params.set('q', query.title);
    if (query.artist) params.set('artist', query.artist);
    if (query.album) params.set('release_title', query.album);
    params.set('per_page', '10');
    params.set('page', '1');
    
    const url = `${DISCOGS_API}/database/search?${params}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'VinylAudioProcessor/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Discogs API error: ${response.status}`);
    }
    
    const data = await response.json();
    const results: SearchResult[] = [];
    
    if (data.results) {
      for (const item of data.results) {
        if (item.type === 'release') {
          results.push({
            type: 'album',
            score: 100 - (results.length * 10),
            data: {
              id: item.id.toString(),
              title: item.title,
              artist: item.artist?.[0]?.name || 'Unknown',
              year: item.year,
              genre: item.genre?.[0],
              style: item.style?.[0],
              coverArt: item.thumb,
              discogsId: item.id.toString(),
              country: item.country
            }
          });
        }
      }
    }
    
    return results;
  } catch (error) {
    console.warn('Discogs search failed:', error);
    return [];
  }
}

export async function searchMetadata(
  query: MetadataSearchQuery,
  onProgress?: (progress: number) => void
): Promise<SearchResult[]> {
  const allResults: SearchResult[] = [];
  
  if (onProgress) onProgress(20);
  
  const mbTracks = await searchMusicBrainz(query, 'recording');
  allResults.push(...mbTracks);
  
  if (onProgress) onProgress(50);
  
  const mbAlbums = await searchMusicBrainz(query, 'release');
  allResults.push(...mbAlbums);
  
  if (onProgress) onProgress(80);
  
  const discogsResults = await searchDiscogs(query);
  allResults.push(...discogsResults);
  
  allResults.sort((a, b) => b.score - a.score);
  
  const uniqueIds = new Set<string>();
  const filtered = allResults.filter(r => {
    const id = (r.data as any).id;
    if (uniqueIds.has(id)) return false;
    uniqueIds.add(id);
    return true;
  });
  
  if (onProgress) onProgress(100);
  
  return filtered;
}

export async function getAlbumArtFromCoverArtArchive(
  mbid: string
): Promise<string | null> {
  try {
    const url = `https://coverartarchive.org/release/${mbid}/front-250`;
    const response = await fetch(url, { method: 'HEAD' });
    
    if (response.ok) {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

export function extractAudioFeatures(
  samples: Float32Array,
  sampleRate: number
): {
  duration: number;
  rmsLevel: number;
  peakLevel: number;
  zeroCrossingRate: number;
  estimatedBpm?: number;
} {
  const duration = samples.length / sampleRate;
  
  let rmsSum = 0;
  let peak = 0;
  let zeroCrossings = 0;
  let lastSign = samples[0] >= 0;
  
  for (let i = 0; i < samples.length; i++) {
    rmsSum += samples[i] * samples[i];
    peak = Math.max(peak, Math.abs(samples[i]));
    
    const currentSign = samples[i] >= 0;
    if (currentSign !== lastSign) {
      zeroCrossings++;
      lastSign = currentSign;
    }
  }
  
  const rms = Math.sqrt(rmsSum / samples.length);
  const zeroCrossingRate = zeroCrossings / samples.length;
  
  let estimatedBpm: number | undefined;
  if (sampleRate >= 8000) {
    const windowSize = Math.floor(sampleRate * 0.1);
    const energy: number[] = [];
    
    for (let i = 0; i < samples.length - windowSize; i += windowSize) {
      let e = 0;
      for (let j = 0; j < windowSize; j++) {
        e += samples[i + j] * samples[i + j];
      }
      energy.push(e / windowSize);
    }
    
    let maxCorrelation = 0;
    let bestLag = 0;
    
    for (let lag = 10; lag < Math.min(energy.length, 100); lag++) {
      let corr = 0;
      for (let i = 0; i < energy.length - lag; i++) {
        corr += energy[i] * energy[i + lag];
      }
      if (corr > maxCorrelation) {
        maxCorrelation = corr;
        bestLag = lag;
      }
    }
    
    if (bestLag > 0) {
      const bpm = 60 / (bestLag * 0.1);
      if (bpm >= 60 && bpm <= 200) {
        estimatedBpm = Math.round(bpm);
      }
    }
  }
  
  return {
    duration,
    rmsLevel: 20 * Math.log10(rms + 1e-10),
    peakLevel: 20 * Math.log10(peak + 1e-10),
    zeroCrossingRate,
    estimatedBpm
  };
}

export function formatMetadataForExport(track: Partial<TrackInfo>): {
  title: string;
  artist: string;
  album: string;
  year?: number;
  trackNumber?: number;
  genre?: string;
} {
  return {
    title: track.title || 'Untitled',
    artist: track.artist || 'Unknown Artist',
    album: track.album || 'Unknown Album',
    year: track.year,
    trackNumber: track.trackNumber,
    genre: track.genre
  };
}
