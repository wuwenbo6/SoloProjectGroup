import requests
import os
import json
from typing import List, Dict, Optional
from dataclasses import dataclass
from datetime import datetime


@dataclass
class OperaAudio:
    id: str
    name: str
    opera_type: str
    singer: str
    duration: float
    download_url: str
    upload_date: str
    description: str


class OperaAPIClient:
    def __init__(self, base_url: str = "https://api.opera-database.example.com", api_key: Optional[str] = None):
        self.base_url = base_url
        self.api_key = api_key
        self.session = requests.Session()
        if api_key:
            self.session.headers.update({"Authorization": f"Bearer {api_key}"})

    def search_opera(self, keyword: str, opera_type: Optional[str] = None, limit: int = 20) -> List[OperaAudio]:
        endpoint = f"{self.base_url}/api/v1/search"
        params = {"keyword": keyword, "limit": limit}
        if opera_type:
            params["opera_type"] = opera_type

        try:
            response = self.session.get(endpoint, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            return [self._parse_opera_audio(item) for item in data.get("results", [])]
        except requests.RequestException as e:
            print(f"API请求失败: {e}")
            return []

    def get_opera_types(self) -> List[str]:
        endpoint = f"{self.base_url}/api/v1/opera-types"
        try:
            response = self.session.get(endpoint, timeout=30)
            response.raise_for_status()
            return response.json().get("types", ["祁剧", "潮剧", "京剧", "越剧", "黄梅戏"])
        except requests.RequestException as e:
            print(f"获取戏曲类型失败: {e}")
            return ["祁剧", "潮剧", "京剧", "越剧", "黄梅戏"]

    def get_singers(self, opera_type: Optional[str] = None) -> List[str]:
        endpoint = f"{self.base_url}/api/v1/singers"
        params = {}
        if opera_type:
            params["opera_type"] = opera_type
        try:
            response = self.session.get(endpoint, params=params, timeout=30)
            response.raise_for_status()
            return response.json().get("singers", [])
        except requests.RequestException as e:
            print(f"获取传承人列表失败: {e}")
            return []

    def download_audio(self, opera_audio: OperaAudio, save_dir: str) -> Optional[str]:
        if not os.path.exists(save_dir):
            os.makedirs(save_dir)

        file_ext = os.path.splitext(opera_audio.download_url)[1] or '.wav'
        file_name = f"{opera_audio.opera_type}_{opera_audio.singer}_{opera_audio.id}{file_ext}"
        save_path = os.path.join(save_dir, file_name)

        try:
            response = self.session.get(opera_audio.download_url, stream=True, timeout=60)
            response.raise_for_status()
            with open(save_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            return save_path
        except requests.RequestException as e:
            print(f"下载音频失败: {e}")
            return None

    def get_audio_metadata(self, audio_id: str) -> Optional[Dict]:
        endpoint = f"{self.base_url}/api/v1/audio/{audio_id}"
        try:
            response = self.session.get(endpoint, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"获取元数据失败: {e}")
            return None

    def batch_download(self, opera_list: List[OperaAudio], save_dir: str) -> List[str]:
        downloaded_files = []
        for opera in opera_list:
            path = self.download_audio(opera, save_dir)
            if path:
                downloaded_files.append(path)
        return downloaded_files

    def _parse_opera_audio(self, data: Dict) -> OperaAudio:
        return OperaAudio(
            id=data.get("id", ""),
            name=data.get("name", ""),
            opera_type=data.get("opera_type", ""),
            singer=data.get("singer", ""),
            duration=data.get("duration", 0.0),
            download_url=data.get("download_url", ""),
            upload_date=data.get("upload_date", datetime.now().isoformat()),
            description=data.get("description", "")
        )

    def get_mock_data(self, opera_type: str = "祁剧", count: int = 10) -> List[OperaAudio]:
        mock_opera = []
        singers = {
            "祁剧": ["李传承人", "王大师", "张艺术家", "刘老艺人"],
            "潮剧": ["陈名家", "林师傅", "黄传人", "郑老师"],
            "京剧": ["梅派传人", "程派名家", "荀派艺术家"],
            "越剧": ["袁派传人", "尹派名家", "范派艺术家"]
        }

        singer_list = singers.get(opera_type, ["未知传承人"])

        for i in range(count):
            mock_opera.append(OperaAudio(
                id=f"mock_{opera_type}_{i:03d}",
                name=f"{opera_type}选段_{i+1}",
                opera_type=opera_type,
                singer=singer_list[i % len(singer_list)],
                duration=180.0 + i * 30,
                download_url=f"https://example.com/audio/{opera_type}_{i}.wav",
                upload_date=datetime.now().isoformat(),
                description=f"{opera_type}传统唱腔选段，由{singer_list[i % len(singer_list)]}演唱"
            ))
        return mock_opera

    def save_metadata(self, opera_list: List[OperaAudio], output_path: str):
        data = [vars(opera) for opera in opera_list]
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
