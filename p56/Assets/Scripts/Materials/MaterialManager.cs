using UnityEngine;
using System.Collections.Generic;

namespace TieDyeGame.Materials
{
    public class MaterialManager : Singleton<MaterialManager>
    {
        [Header("布料列表")]
        public List<FabricData> allFabrics = new List<FabricData>();

        [Header("染料列表")]
        public List<DyeColor> allDyes = new List<DyeColor>();

        [Header("捆扎方式列表")]
        public List<TieMethod> allTieMethods = new List<TieMethod>();

        [Header("当前选择")]
        public FabricData selectedFabric;
        public DyeColor selectedDye;
        public TieMethod selectedTieMethod;
        public List<DyeColor> selectedDyes = new List<DyeColor>();

        private void Start()
        {
            InitializeDefaults();
        }

        private void InitializeDefaults()
        {
            if (allFabrics.Count > 0)
            {
                selectedFabric = allFabrics.Find(f => f.isUnlockedByDefault);
                if (selectedFabric == null) selectedFabric = allFabrics[0];
            }

            if (allDyes.Count > 0)
            {
                var defaultDyes = allDyes.FindAll(d => d.isUnlockedByDefault);
                selectedDyes = defaultDyes.Count > 0 ? defaultDyes : allDyes.GetRange(0, Mathf.Min(3, allDyes.Count));
                if (selectedDyes.Count > 0) selectedDye = selectedDyes[0];
            }

            if (allTieMethods.Count > 0)
            {
                selectedTieMethod = allTieMethods.Find(t => t.isUnlockedByDefault);
                if (selectedTieMethod == null) selectedTieMethod = allTieMethods[0];
            }
        }

        public List<FabricData> GetUnlockedFabrics(int playerLevel)
        {
            return allFabrics.FindAll(f => f.isUnlockedByDefault || f.requiredLevel <= playerLevel);
        }

        public List<DyeColor> GetUnlockedDyes(int playerLevel)
        {
            return allDyes.FindAll(d => d.isUnlockedByDefault || d.requiredLevel <= playerLevel);
        }

        public List<TieMethod> GetUnlockedTieMethods(int playerLevel)
        {
            return allTieMethods.FindAll(t => t.isUnlockedByDefault || t.requiredLevel <= playerLevel);
        }

        public void SelectFabric(FabricData fabric)
        {
            selectedFabric = fabric;
        }

        public void SelectDye(DyeColor dye)
        {
            selectedDye = dye;
        }

        public void AddDyeToSelection(DyeColor dye)
        {
            if (!selectedDyes.Contains(dye))
            {
                selectedDyes.Add(dye);
            }
        }

        public void RemoveDyeFromSelection(DyeColor dye)
        {
            selectedDyes.Remove(dye);
        }

        public void SelectTieMethod(TieMethod method)
        {
            selectedTieMethod = method;
        }

        public FabricData GetFabricByName(string name)
        {
            return allFabrics.Find(f => f.fabricName == name);
        }

        public DyeColor GetDyeByName(string name)
        {
            return allDyes.Find(d => d.dyeName == name);
        }

        public TieMethod GetTieMethodByName(string name)
        {
            return allTieMethods.Find(t => t.methodName == name);
        }
    }
}
