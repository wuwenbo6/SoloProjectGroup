using UnityEngine;
using MortiseTenonGame.MortiseTenon;
using MortiseTenonGame.Physics;

namespace MortiseTenonGame.Editor
{
    public class PiecePrefabGenerator
    {
        public static GameObject CreateStraightTenonPiece()
        {
            GameObject pieceObj = new GameObject("StraightTenon");
            var piece = pieceObj.AddComponent<MortiseTenonPiece>();

            GameObject tenon = GameObject.CreatePrimitive(PrimitiveType.Cube);
            tenon.name = "Tenon";
            tenon.transform.SetParent(pieceObj.transform);
            tenon.transform.localPosition = new Vector3(0.25f, 0, 0);
            tenon.transform.localScale = new Vector3(0.5f, 0.3f, 0.3f);

            GameObject mortise = GameObject.CreatePrimitive(PrimitiveType.Cube);
            mortise.name = "Mortise";
            mortise.transform.SetParent(pieceObj.transform);
            mortise.transform.localPosition = new Vector3(-0.25f, 0, 0);
            mortise.transform.localScale = new Vector3(0.5f, 0.3f, 0.3f);

            GameObject jointObj = new GameObject("Joint_Tenon");
            jointObj.transform.SetParent(pieceObj.transform);
            jointObj.transform.localPosition = new Vector3(0.5f, 0, 0);
            var joint = jointObj.AddComponent<MortiseTenonJoint>();

            GameObject jointObj2 = new GameObject("Joint_Mortise");
            jointObj2.transform.SetParent(pieceObj.transform);
            jointObj2.transform.localPosition = new Vector3(-0.5f, 0, 0);
            var joint2 = jointObj2.AddComponent<MortiseTenonJoint>();

            Rigidbody rb = pieceObj.GetComponent<Rigidbody>();
            if (rb == null) rb = pieceObj.AddComponent<Rigidbody>();
            rb.mass = 1f;
            rb.drag = 0.5f;
            rb.angularDrag = 0.5f;

            Collider collider = pieceObj.GetComponent<Collider>();
            if (collider == null)
            {
                collider = pieceObj.AddComponent<BoxCollider>();
                (collider as BoxCollider).size = new Vector3(1.2f, 0.35f, 0.35f);
            }

            pieceObj.layer = LayerMask.NameToLayer("Piece");

            return pieceObj;
        }

        public static GameObject CreateLShapedPiece()
        {
            GameObject pieceObj = new GameObject("LShapedTenon");
            var piece = pieceObj.AddComponent<MortiseTenonPiece>();

            GameObject armX = GameObject.CreatePrimitive(PrimitiveType.Cube);
            armX.name = "ArmX";
            armX.transform.SetParent(pieceObj.transform);
            armX.transform.localPosition = new Vector3(0.25f, 0, 0);
            armX.transform.localScale = new Vector3(0.5f, 0.25f, 0.25f);

            GameObject armZ = GameObject.CreatePrimitive(PrimitiveType.Cube);
            armZ.name = "ArmZ";
            armZ.transform.SetParent(pieceObj.transform);
            armZ.transform.localPosition = new Vector3(0, 0, 0.25f);
            armZ.transform.localScale = new Vector3(0.25f, 0.25f, 0.5f);

            Rigidbody rb = pieceObj.GetComponent<Rigidbody>();
            if (rb == null) rb = pieceObj.AddComponent<Rigidbody>();
            rb.mass = 1f;

            Collider collider = pieceObj.GetComponent<Collider>();
            if (collider == null)
            {
                collider = pieceObj.AddComponent<BoxCollider>();
                (collider as BoxCollider).size = new Vector3(0.8f, 0.3f, 0.8f);
            }

            pieceObj.layer = LayerMask.NameToLayer("Piece");

            return pieceObj;
        }
    }
}