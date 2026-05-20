#include "Build/MT_PartLibrary.h"

UMT_PartLibrary::UMT_PartLibrary()
{
}

void UMT_PartLibrary::InitializeLibrary()
{
    LoadDefaultParts();
}

TArray<FPartDefinition> UMT_PartLibrary::GetPartsByCategory(EPartCategory Category) const
{
    TArray<FPartDefinition> Result;
    for (const FPartDefinition& Part : PartDefinitions)
    {
        if (Part.Category == Category)
        {
            Result.Add(Part);
        }
    }
    return Result;
}

FPartDefinition UMT_PartLibrary::GetPartByID(const FString& PartID) const
{
    for (const FPartDefinition& Part : PartDefinitions)
    {
        if (Part.PartID == PartID)
        {
            return Part;
        }
    }
    return FPartDefinition();
}

void UMT_PartLibrary::AddCustomPart(const FPartDefinition& NewPart)
{
    PartDefinitions.Add(NewPart);
    if (NewPart.bIsUnlockedByDefault)
    {
        UnlockedPartIDs.AddUnique(NewPart.PartID);
    }
}

bool UMT_PartLibrary::UnlockPart(const FString& PartID, float PlayerScore)
{
    FPartDefinition Part = GetPartByID(PartID);
    if (!Part.PartID.IsEmpty() && PlayerScore >= Part.UnlockScore && !UnlockedPartIDs.Contains(PartID))
    {
        UnlockedPartIDs.Add(PartID);
        return true;
    }
    return false;
}

bool UMT_PartLibrary::IsPartUnlocked(const FString& PartID) const
{
    return UnlockedPartIDs.Contains(PartID);
}

void UMT_PartLibrary::LoadDefaultParts()
{
    PartDefinitions.Empty();
    UnlockedPartIDs.Empty();

    FPartDefinition BasicBeam;
    BasicBeam.PartID = TEXT("PART_BASIC_BEAM_001");
    BasicBeam.PartName = TEXT("基础木梁");
    BasicBeam.Description = TEXT("标准的长方形木梁，是各种结构的基础部件");
    BasicBeam.Category = EPartCategory::PC_Basic;
    BasicBeam.UnlockScore = 0.0f;
    BasicBeam.MaxCountInBuild = 50;
    BasicBeam.bIsUnlockedByDefault = true;
    BasicBeam.CompatibleParts = { TEXT("PART_TENON_001"), TEXT("PART_MORTISE_001"), TEXT("PART_DOWEL_001") };
    AddCustomPart(BasicBeam);

    FPartDefinition SquareColumn;
    SquareColumn.PartID = TEXT("PART_SQUARE_COLUMN_001");
    SquareColumn.PartName = TEXT("方形立柱");
    SquareColumn.Description = TEXT("正方形截面的立柱，用于支撑结构");
    SquareColumn.Category = EPartCategory::PC_Basic;
    SquareColumn.UnlockScore = 0.0f;
    SquareColumn.MaxCountInBuild = 30;
    SquareColumn.bIsUnlockedByDefault = true;
    SquareColumn.CompatibleParts = { TEXT("PART_TENON_001"), TEXT("PART_MORTISE_001") };
    AddCustomPart(SquareColumn);

    FPartDefinition FlatBoard;
    FlatBoard.PartID = TEXT("PART_FLAT_BOARD_001");
    FlatBoard.PartName = TEXT("平面木板");
    FlatBoard.Description = TEXT("薄而平的木板，可作桌面、墙面等");
    FlatBoard.Category = EPartCategory::PC_Basic;
    FlatBoard.UnlockScore = 0.0f;
    FlatBoard.MaxCountInBuild = 40;
    FlatBoard.bIsUnlockedByDefault = true;
    FlatBoard.CompatibleParts = { TEXT("PART_DOVETAIL_MALE_001"), TEXT("PART_DOVETAIL_FEMALE_001") };
    AddCustomPart(FlatBoard);

    FPartDefinition TenonJoint;
    TenonJoint.PartID = TEXT("PART_TENON_001");
    TenonJoint.PartName = TEXT("凸榫头");
    TenonJoint.Description = TEXT("凸出的榫头部件，用于与卯眼配合连接");
    TenonJoint.Category = EPartCategory::PC_Connector;
    TenonJoint.UnlockScore = 0.0f;
    TenonJoint.MaxCountInBuild = 100;
    TenonJoint.bIsUnlockedByDefault = true;
    TenonJoint.CompatibleParts = { TEXT("PART_MORTISE_001"), TEXT("PART_BASIC_BEAM_001") };
    AddCustomPart(TenonJoint);

    FPartDefinition MortiseJoint;
    MortiseJoint.PartID = TEXT("PART_MORTISE_001");
    MortiseJoint.PartName = TEXT("凹卯眼");
    MortiseJoint.Description = TEXT("凹入的卯眼部件，用于承接榫头");
    MortiseJoint.Category = EPartCategory::PC_Connector;
    MortiseJoint.UnlockScore = 0.0f;
    MortiseJoint.MaxCountInBuild = 100;
    MortiseJoint.bIsUnlockedByDefault = true;
    MortiseJoint.CompatibleParts = { TEXT("PART_TENON_001"), TEXT("PART_BASIC_BEAM_001") };
    AddCustomPart(MortiseJoint);

    FPartDefinition DovetailMale;
    DovetailMale.PartID = TEXT("PART_DOVETAIL_MALE_001");
    DovetailMale.PartName = TEXT("燕尾榫(凸)");
    DovetailMale.Description = TEXT("燕尾形的凸榫头，提供强大的抗拉力");
    DovetailMale.Category = EPartCategory::PC_Connector;
    DovetailMale.UnlockScore = 500.0f;
    DovetailMale.MaxCountInBuild = 50;
    DovetailMale.bIsUnlockedByDefault = false;
    DovetailMale.CompatibleParts = { TEXT("PART_DOVETAIL_FEMALE_001"), TEXT("PART_FLAT_BOARD_001") };
    AddCustomPart(DovetailMale);

    FPartDefinition DovetailFemale;
    DovetailFemale.PartID = TEXT("PART_DOVETAIL_FEMALE_001");
    DovetailFemale.PartName = TEXT("燕尾榫(凹)");
    DovetailFemale.Description = TEXT("燕尾形的凹槽，与凸榫配合");
    DovetailFemale.Category = EPartCategory::PC_Connector;
    DovetailFemale.UnlockScore = 500.0f;
    DovetailFemale.MaxCountInBuild = 50;
    DovetailFemale.bIsUnlockedByDefault = false;
    DovetailFemale.CompatibleParts = { TEXT("PART_DOVETAIL_MALE_001"), TEXT("PART_FLAT_BOARD_001") };
    AddCustomPart(DovetailFemale);

    FPartDefinition Dowel;
    Dowel.PartID = TEXT("PART_DOWEL_001");
    Dowel.PartName = TEXT("圆销钉");
    Dowel.Description = TEXT("圆柱形的销钉，用于加强连接");
    Dowel.Category = EPartCategory::PC_Connector;
    Dowel.UnlockScore = 200.0f;
    Dowel.MaxCountInBuild = 200;
    Dowel.bIsUnlockedByDefault = true;
    Dowel.CompatibleParts = { TEXT("PART_BASIC_BEAM_001"), TEXT("PART_SQUARE_COLUMN_001") };
    AddCustomPart(Dowel);

    FPartDefinition CornerBracket;
    CornerBracket.PartID = TEXT("PART_CORNER_BRACKET_001");
    CornerBracket.PartName = TEXT("角撑");
    CornerBracket.Description = TEXT("用于加固直角连接处的支撑部件");
    CornerBracket.Category = EPartCategory::PC_Structural;
    CornerBracket.UnlockScore = 800.0f;
    CornerBracket.MaxCountInBuild = 30;
    CornerBracket.bIsUnlockedByDefault = false;
    CornerBracket.CompatibleParts = { TEXT("PART_BASIC_BEAM_001"), TEXT("PART_SQUARE_COLUMN_001") };
    AddCustomPart(CornerBracket);

    FPartDefinition TriangularBrace;
    TriangularBrace.PartID = TEXT("PART_TRIANGULAR_BRACE_001");
    TriangularBrace.PartName = TEXT("三角斜撑");
    TriangularBrace.Description = TEXT("三角形的支撑结构，增强整体稳定性");
    TriangularBrace.Category = EPartCategory::PC_Structural;
    TriangularBrace.UnlockScore = 1000.0f;
    TriangularBrace.MaxCountInBuild = 20;
    TriangularBrace.bIsUnlockedByDefault = false;
    TriangularBrace.CompatibleParts = { TEXT("PART_BASIC_BEAM_001"), TEXT("PART_SQUARE_COLUMN_001") };
    AddCustomPart(TriangularBrace);

    FPartDefinition CarvedPattern;
    CarvedPattern.PartID = TEXT("PART_CARVED_PATTERN_001");
    CarvedPattern.PartName = TEXT("雕花图案");
    CarvedPattern.Description = TEXT("带有传统雕刻图案的装饰部件");
    CarvedPattern.Category = EPartCategory::PC_Decorative;
    CarvedPattern.UnlockScore = 600.0f;
    CarvedPattern.MaxCountInBuild = 50;
    CarvedPattern.bIsUnlockedByDefault = false;
    CarvedPattern.CompatibleParts = { TEXT("PART_FLAT_BOARD_001") };
    AddCustomPart(CarvedPattern);

    FPartDefinition DougongBracket;
    DougongBracket.PartID = TEXT("PART_DOUGONG_001");
    DougongBracket.PartName = TEXT("斗拱");
    DougongBracket.Description = TEXT("中国古代建筑特有的斗拱结构，兼具承重与装饰功能");
    DougongBracket.Category = EPartCategory::PC_Advanced;
    DougongBracket.UnlockScore = 2000.0f;
    DougongBracket.MaxCountInBuild = 15;
    DougongBracket.bIsUnlockedByDefault = false;
    DougongBracket.CompatibleParts = { TEXT("PART_SQUARE_COLUMN_001"), TEXT("PART_BASIC_BEAM_001") };
    AddCustomPart(DougongBracket);

    FPartDefinition ZangfengJoint;
    ZangfengJoint.PartID = TEXT("PART_ZANG_FENG_001");
    ZangfengJoint.PartName = TEXT("粽角榫");
    ZangfengJoint.Description = TEXT("又称万榫之母，三个面都能看到榫头的复杂连接");
    ZangfengJoint.Category = EPartCategory::PC_Advanced;
    ZangfengJoint.UnlockScore = 2500.0f;
    ZangfengJoint.MaxCountInBuild = 10;
    ZangfengJoint.bIsUnlockedByDefault = false;
    ZangfengJoint.CompatibleParts = { TEXT("PART_BASIC_BEAM_001"), TEXT("PART_SQUARE_COLUMN_001") };
    AddCustomPart(ZangfengJoint);

    FPartDefinition BawangZhang;
    BawangZhang.PartID = TEXT("PART_BAWANG_ZHANG_001");
    BawangZhang.PartName = TEXT("霸王枨");
    BawangZhang.Description = TEXT("连接桌面与腿足的斜向构件，既加固又美观");
    BawangZhang.Category = EPartCategory::PC_Advanced;
    BawangZhang.UnlockScore = 1800.0f;
    BawangZhang.MaxCountInBuild = 12;
    BawangZhang.bIsUnlockedByDefault = false;
    BawangZhang.CompatibleParts = { TEXT("PART_FLAT_BOARD_001"), TEXT("PART_SQUARE_COLUMN_001") };
    AddCustomPart(BawangZhang);
}
