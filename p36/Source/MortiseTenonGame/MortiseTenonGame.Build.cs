using UnrealBuildTool;

public class MortiseTenonGame : ModuleRules
{
    public MortiseTenonGame(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        
        PublicDependencyModuleNames.AddRange(new string[] 
        { 
            "Core", 
            "CoreUObject", 
            "Engine", 
            "InputCore",
            "PhysicsCore",
            "UMG",
            "Slate",
            "SlateCore",
            "Json",
            "JsonUtilities"
        });
        
        PrivateDependencyModuleNames.AddRange(new string[] { });
    }
}
