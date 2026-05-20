from setuptools import setup, find_packages

setup(
    name="canopen-master",
    version="1.0.0",
    description="CANopen Master CLI Tool",
    author="CANopen Team",
    packages=find_packages(),
    install_requires=[
        "canopen>=2.2.0",
        "python-can>=4.3.0",
        "click>=8.1.0",
        "python-dotenv>=1.0.0",
        "colorama>=0.4.6",
    ],
    entry_points={
        "console_scripts": [
            "canopen-master=canopen_master.cli.main:cli",
        ],
    },
    python_requires=">=3.8",
)
