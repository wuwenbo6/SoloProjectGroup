from setuptools import setup, find_packages

setup(
    name="fem-simulation",
    version="0.1.0",
    description="2D/3D Finite Element Structural Mechanics Simulation",
    author="FEniCS Simulation Team",
    packages=find_packages(),
    install_requires=[
        "numpy>=1.21.0",
        "scipy>=1.7.0",
        "matplotlib>=3.4.0",
        "h5py>=3.2.0",
        "meshio>=5.0.0",
    ],
    python_requires=">=3.8",
)
