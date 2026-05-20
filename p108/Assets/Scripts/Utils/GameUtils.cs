using UnityEngine;

namespace MortiseTenonGame.Utils
{
    public static class MathUtils
    {
        public static float Remap(float value, float fromMin, float fromMax, float toMin, float toMax)
        {
            return toMin + (value - fromMin) * (toMax - toMin) / (fromMax - fromMin);
        }

        public static float ClampAngle(float angle, float min, float max)
        {
            if (angle < -360f)
                angle += 360f;
            if (angle > 360f)
                angle -= 360f;
            return Mathf.Clamp(angle, min, max);
        }

        public static Vector3 RoundVector3(Vector3 vector, int decimals = 2)
        {
            float multiplier = Mathf.Pow(10, decimals);
            return new Vector3(
                Mathf.Round(vector.x * multiplier) / multiplier,
                Mathf.Round(vector.y * multiplier) / multiplier,
                Mathf.Round(vector.z * multiplier) / multiplier
            );
        }

        public static bool Approximately(Vector3 a, Vector3 b, float tolerance = 0.01f)
        {
            return Vector3.Distance(a, b) < tolerance;
        }

        public static bool Approximately(Quaternion a, Quaternion b, float tolerance = 0.01f)
        {
            return Quaternion.Angle(a, b) < tolerance;
        }
    }

    public static class UnityUtils
    {
        public static void DestroyAllChildren(Transform parent)
        {
            for (int i = parent.childCount - 1; i >= 0; i--)
            {
                GameObject.Destroy(parent.GetChild(i).gameObject);
            }
        }

        public static T GetOrAddComponent<T>(GameObject gameObject) where T : Component
        {
            T component = gameObject.GetComponent<T>();
            if (component == null)
            {
                component = gameObject.AddComponent<T>();
            }
            return component;
        }

        public static void SetLayerRecursively(GameObject gameObject, int layer)
        {
            gameObject.layer = layer;
            foreach (Transform child in gameObject.transform)
            {
                SetLayerRecursively(child.gameObject, layer);
            }
        }
    }

    public static class ColorUtils
    {
        public static readonly Color WoodLight = new Color(0.87f, 0.72f, 0.53f);
        public static readonly Color WoodMedium = new Color(0.75f, 0.57f, 0.38f);
        public static readonly Color WoodDark = new Color(0.55f, 0.38f, 0.23f);
        public static readonly Color Mahogany = new Color(0.5f, 0.25f, 0.15f);
        public static readonly Color Ebony = new Color(0.15f, 0.1f, 0.08f);

        public static Color HexToColor(string hex)
        {
            hex = hex.Replace("#", "");
            byte r = byte.Parse(hex.Substring(0, 2), System.Globalization.NumberStyles.HexNumber);
            byte g = byte.Parse(hex.Substring(2, 2), System.Globalization.NumberStyles.HexNumber);
            byte b = byte.Parse(hex.Substring(4, 2), System.Globalization.NumberStyles.HexNumber);
            return new Color32(r, g, b, 255);
        }
    }
}