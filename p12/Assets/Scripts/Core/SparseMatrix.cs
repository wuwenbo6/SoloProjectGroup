using System;
using System.Collections.Generic;

namespace CircuitSimulator.Core
{
    public class SparseMatrix
    {
        private Dictionary<int, float>[] rows;
        private int size;

        public int Size => size;

        public SparseMatrix(int matrixSize)
        {
            size = matrixSize;
            rows = new Dictionary<int, float>[size];
            for (int i = 0; i < size; i++)
            {
                rows[i] = new Dictionary<int, float>();
            }
        }

        public float this[int row, int col]
        {
            get
            {
                if (rows[row].TryGetValue(col, out float value))
                    return value;
                return 0f;
            }
            set
            {
                if (Math.Abs(value) < 1e-10f)
                {
                    rows[row].Remove(col);
                }
                else
                {
                    rows[row][col] = value;
                }
            }
        }

        public void Add(int row, int col, float value)
        {
            if (rows[row].TryGetValue(col, out float existing))
            {
                float newValue = existing + value;
                if (Math.Abs(newValue) < 1e-10f)
                {
                    rows[row].Remove(col);
                }
                else
                {
                    rows[row][col] = newValue;
                }
            }
            else
            {
                if (Math.Abs(value) > 1e-10f)
                {
                    rows[row][col] = value;
                }
            }
        }

        public IEnumerable<(int col, float value)> GetRowNonZero(int row)
        {
            foreach (var kvp in rows[row])
            {
                yield return (kvp.Key, kvp.Value);
            }
        }

        public int NonZeroCount()
        {
            int count = 0;
            for (int i = 0; i < size; i++)
            {
                count += rows[i].Count;
            }
            return count;
        }

        public void Clear()
        {
            for (int i = 0; i < size; i++)
            {
                rows[i].Clear();
            }
        }

        public void Resize(int newSize)
        {
            size = newSize;
            Array.Resize(ref rows, newSize);
            for (int i = 0; i < size; i++)
            {
                if (rows[i] == null)
                {
                    rows[i] = new Dictionary<int, float>();
                }
            }
        }
    }

    public class SparseLinearSolver
    {
        public static bool SolveGaussSeidel(SparseMatrix matrix, float[] b, float[] x, 
            int maxIterations = 100, float tolerance = 1e-6f)
        {
            int n = matrix.Size;
            if (b.Length != n || x.Length != n)
                throw new ArgumentException("Vector size mismatch");

            for (int iter = 0; iter < maxIterations; iter++)
            {
                float maxDiff = 0f;

                for (int i = 0; i < n; i++)
                {
                    float sum = b[i];
                    float diagonal = 0f;

                    foreach (var (col, value) in matrix.GetRowNonZero(i))
                    {
                        if (col == i)
                        {
                            diagonal = value;
                        }
                        else
                        {
                            sum -= value * x[col];
                        }
                    }

                    if (Math.Abs(diagonal) < 1e-10f)
                    {
                        if (Math.Abs(sum) > 1e-6f)
                            return false;
                        continue;
                    }

                    float newX = sum / diagonal;
                    maxDiff = Math.Max(maxDiff, Math.Abs(newX - x[i]));
                    x[i] = newX;
                }

                if (maxDiff < tolerance)
                {
                    return true;
                }
            }

            return true;
        }

        public static bool SolveConjugateGradient(SparseMatrix matrix, float[] b, float[] x,
            int maxIterations = 1000, float tolerance = 1e-6f)
        {
            int n = matrix.Size;
            float[] r = new float[n];
            float[] p = new float[n];
            float[] Ap = new float[n];

            for (int i = 0; i < n; i++)
            {
                r[i] = b[i];
            }

            MultiplyMatrixVector(matrix, x, Ap);
            for (int i = 0; i < n; i++)
            {
                r[i] -= Ap[i];
                p[i] = r[i];
            }

            float rsold = DotProduct(r, r);
            if (rsold < tolerance * tolerance)
                return true;

            for (int iter = 0; iter < maxIterations; iter++)
            {
                MultiplyMatrixVector(matrix, p, Ap);

                float pAp = DotProduct(p, Ap);
                if (Math.Abs(pAp) < 1e-10f)
                    break;

                float alpha = rsold / pAp;

                for (int i = 0; i < n; i++)
                {
                    x[i] += alpha * p[i];
                    r[i] -= alpha * Ap[i];
                }

                float rsnew = DotProduct(r, r);
                if (Math.Sqrt(rsnew) < tolerance)
                    return true;

                float beta = rsnew / rsold;

                for (int i = 0; i < n; i++)
                {
                    p[i] = r[i] + beta * p[i];
                }

                rsold = rsnew;
            }

            return true;
        }

        private static void MultiplyMatrixVector(SparseMatrix matrix, float[] vec, float[] result)
        {
            int n = matrix.Size;
            for (int i = 0; i < n; i++)
            {
                result[i] = 0f;
                foreach (var (col, value) in matrix.GetRowNonZero(i))
                {
                    result[i] += value * vec[col];
                }
            }
        }

        private static float DotProduct(float[] a, float[] b)
        {
            float sum = 0f;
            for (int i = 0; i < a.Length; i++)
            {
                sum += a[i] * b[i];
            }
            return sum;
        }
    }
}