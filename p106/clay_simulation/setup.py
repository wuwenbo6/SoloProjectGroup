from setuptools import setup, find_packages

setup(
    name='clay_simulation',
    version='1.0.0',
    description='传统泥塑工艺受力数值模拟系统',
    author='Clay Simulation Team',
    packages=find_packages(),
    install_requires=[
        'numpy>=1.21.0',
        'scipy>=1.7.0',
        'matplotlib>=3.4.0',
        'h5py>=3.2.0',
        'scikit-learn>=0.24.0'
    ],
    extras_require={
        'dev': [
            'pytest>=6.0',
            'pytest-cov>=2.0'
        ]
    },
    python_requires='>=3.8',
    entry_points={
        'console_scripts': [
            'clay-sim=examples.basic_simulation:main',
        ],
    },
    include_package_data=True,
    zip_safe=False
)
