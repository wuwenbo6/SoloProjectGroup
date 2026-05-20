using UnrealBuildTool;
using System.Collections.Generic;

public class MortiseTenonGameTarget : TargetRules
{
    public MortiseTenonGameTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.V4;
        IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_3;
        ExtraModuleNames.AddRange(new string[] { "MortiseTenonGame" });
    }
}
