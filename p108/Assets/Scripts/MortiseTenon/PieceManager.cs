using UnityEngine;
using System.Collections.Generic;
using MortiseTenonGame.Core;
using MortiseTenonGame.Physics;

namespace MortiseTenonGame.MortiseTenon
{
    public class PieceManager : Singleton<PieceManager>
    {
        [Header("Piece Prefabs")]
        [SerializeField] private List<MortiseTenonPiece> _piecePrefabs = new List<MortiseTenonPiece>();

        [Header("Spawn Settings")]
        [SerializeField] private Transform _spawnArea;
        [SerializeField] private float _spawnSpacing = 0.5f;

        private List<MortiseTenonPiece> _spawnedPieces = new List<MortiseTenonPiece>();
        private MortiseTenonPiece _selectedPiece;

        public MortiseTenonPiece SelectedPiece => _selectedPiece;
        public IReadOnlyList<MortiseTenonPiece> SpawnedPieces => _spawnedPieces.AsReadOnly();

        public MortiseTenonPiece SpawnPiece(string pieceId, Vector3 position, Quaternion rotation)
        {
            var prefab = _piecePrefabs.Find(p => p.PieceId == pieceId);
            if (prefab == null)
            {
                Debug.LogError($"Piece with ID {pieceId} not found!");
                return null;
            }

            var piece = Instantiate(prefab, position, rotation);
            _spawnedPieces.Add(piece);

            return piece;
        }

        public MortiseTenonPiece SpawnPiece(PieceType type, Vector3 position, Quaternion rotation)
        {
            var prefab = _piecePrefabs.Find(p => p.PieceType == type);
            if (prefab == null)
            {
                Debug.LogError($"Piece with type {type} not found!");
                return null;
            }

            var piece = Instantiate(prefab, position, rotation);
            _spawnedPieces.Add(piece);

            return piece;
        }

        public void SelectPiece(MortiseTenonPiece piece)
        {
            if (_selectedPiece != null)
            {
                _selectedPiece.Deselect();
            }

            _selectedPiece = piece;
            if (_selectedPiece != null)
            {
                _selectedPiece.Select();
            }
        }

        public void DeselectPiece()
        {
            if (_selectedPiece != null)
            {
                _selectedPiece.Deselect();
                _selectedPiece = null;
            }
        }

        public void DestroyPiece(MortiseTenonPiece piece)
        {
            if (_spawnedPieces.Contains(piece))
            {
                _spawnedPieces.Remove(piece);
                if (_selectedPiece == piece)
                {
                    _selectedPiece = null;
                }
                Destroy(piece.gameObject);
            }
        }

        public void DestroyAllPieces()
        {
            foreach (var piece in _spawnedPieces)
            {
                Destroy(piece.gameObject);
            }
            _spawnedPieces.Clear();
            _selectedPiece = null;
        }

        public void ResetAllPieces()
        {
            foreach (var piece in _spawnedPieces)
            {
                piece.DisconnectAll();
                piece.ResetPiece();
            }
        }

        public float GetTotalConnectionProgress()
        {
            if (_spawnedPieces.Count == 0) return 0f;

            float totalProgress = 0f;
            foreach (var piece in _spawnedPieces)
            {
                totalProgress += piece.GetConnectionProgress();
            }

            return totalProgress / _spawnedPieces.Count;
        }

        public bool AreAllPiecesConnected()
        {
            foreach (var piece in _spawnedPieces)
            {
                if (!piece.IsFullyConnected())
                {
                    return false;
                }
            }
            return true;
        }

        public int GetTotalConnections()
        {
            int count = 0;
            foreach (var piece in _spawnedPieces)
            {
                count += piece.CurrentConnections;
            }
            return count;
        }

        public void RegisterPiecePrefab(MortiseTenonPiece prefab)
        {
            if (!_piecePrefabs.Contains(prefab))
            {
                _piecePrefabs.Add(prefab);
            }
        }

        public List<MortiseTenonPiece> GetPiecesByType(PieceType type)
        {
            return _spawnedPieces.FindAll(p => p.PieceType == type);
        }

        public List<MortiseTenonPiece> GetPiecesByDifficulty(PieceDifficulty difficulty)
        {
            return _spawnedPieces.FindAll(p => p.Difficulty == difficulty);
        }
    }
}