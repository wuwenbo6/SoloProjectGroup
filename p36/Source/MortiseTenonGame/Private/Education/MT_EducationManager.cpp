#include "Education/MT_EducationManager.h"

UMT_EducationManager* UMT_EducationManager::Instance = nullptr;

UMT_EducationManager::UMT_EducationManager()
{
}

UMT_EducationManager* UMT_EducationManager::GetInstance()
{
    if (!Instance)
    {
        Instance = NewObject<UMT_EducationManager>();
        Instance->AddToRoot();
        Instance->InitializeKnowledgeBase();
    }
    return Instance;
}

void UMT_EducationManager::InitializeKnowledgeBase()
{
    InitializeJointDatabase();
    InitializeEducationContent();
}

void UMT_EducationManager::InitializeJointDatabase()
{
    JointKnowledgeDatabase.Empty();

    FJointKnowledgeData DovetailJoint;
    DovetailJoint.JointName = TEXT("DovetailJoint");
    DovetailJoint.ChineseName = TEXT("燕尾榫");
    DovetailJoint.Category = EKnowledgeCategory::KC_JointType;
    DovetailJoint.Description = TEXT("燕尾榫是一种外观像燕子尾巴形状的榫卯结构，因其形状而得名。其特点是榫头呈梯形，两端宽，中间窄，插入卯眼后能紧密咬合，具有极强的抗拉能力。");
    DovetailJoint.HistoricalContext = TEXT("燕尾榫最早出现在新石器时代的河姆渡文化中，距今已有7000多年的历史。经过历代工匠的不断改进，成为中国传统家具和建筑中应用最广泛的榫卯结构之一。");
    DovetailJoint.ApplicationExamples = TEXT("广泛应用于抽屉、箱子、柜子等家具的边角连接，也用于古建筑的木构架连接。");
    DovetailJoint.DifficultyLevel = 1;
    DovetailJoint.bIsUnlocked = true;
    JointKnowledgeDatabase.Add(DovetailJoint);

    FJointKnowledgeData MortiseTenon;
    MortiseTenon.JointName = TEXT("MortiseTenon");
    MortiseTenon.ChineseName = TEXT("榫卯");
    MortiseTenon.Category = EKnowledgeCategory::KC_JointType;
    MortiseTenon.Description = TEXT("榫卯是中国传统木结构最基本的连接方式，由榫头和卯眼两部分组成。榫头是突出的部分，卯眼是凹进的部分，二者结合实现构件的连接。");
    MortiseTenon.HistoricalContext = TEXT("榫卯技术是中国古代木结构建筑的核心技术，贯穿于整个中国古代建筑发展史。从简单的榫卯到复杂的斗拱结构，体现了中国古代工匠的智慧。");
    MortiseTenon.ApplicationExamples = TEXT("家具制作、古建筑木构架、造船、桥梁等。");
    MortiseTenon.DifficultyLevel = 1;
    MortiseTenon.bIsUnlocked = true;
    JointKnowledgeDatabase.Add(MortiseTenon);

    FJointKnowledgeData Bracket;
    Bracket.JointName = TEXT("Bracket");
    Bracket.ChineseName = TEXT("斗拱");
    Bracket.Category = EKnowledgeCategory::KC_Architecture;
    Bracket.Description = TEXT("斗拱是中国古代建筑特有的结构构件，由斗、拱、翘、昂等部件组成。它位于柱梁之间，将屋檐的重量传递到柱子上，同时具有装饰作用。");
    Bracket.HistoricalContext = TEXT("斗拱最早出现在西周时期，经过秦汉、唐宋的发展，到明清时期达到顶峰。它不仅是建筑结构的重要组成部分，也是建筑等级的象征。");
    Bracket.ApplicationExamples = TEXT("宫殿、寺庙、楼阁等大型古建筑的屋檐支撑。");
    Bracket.DifficultyLevel = 3;
    Bracket.bIsUnlocked = false;
    JointKnowledgeDatabase.Add(Bracket);

    FJointKnowledgeData Tenon;
    Tenon.JointName = TEXT("StraightTenon");
    Tenon.ChineseName = TEXT("直榫");
    Tenon.Category = EKnowledgeCategory::KC_JointType;
    Tenon.Description = TEXT("直榫是最基本的榫卯形式，榫头呈长方形，垂直插入卯眼中。结构简单，制作方便，适用于各种构件的连接。");
    Tenon.HistoricalContext = TEXT("直榫是最早出现的榫卯形式之一，在河姆渡遗址中就有发现。经过数千年的发展，衍生出多种变体。");
    Tenon.ApplicationExamples = TEXT("家具框架连接、建筑梁柱连接等。");
    Tenon.DifficultyLevel = 1;
    Tenon.bIsUnlocked = true;
    JointKnowledgeDatabase.Add(Tenon);

    FJointKnowledgeData DovetailMale;
    DovetailMale.JointName = TEXT("DovetailMale");
    DovetailMale.ChineseName = TEXT("燕尾榫凸");
    DovetailMale.Category = EKnowledgeCategory::KC_JointType;
    DovetailMale.Description = TEXT("燕尾榫凸是燕尾榫结构中的榫头部分，呈梯形，两端大中间小。制作时需要精确的角度和尺寸，以确保与卯眼的完美配合。");
    DovetailMale.HistoricalContext = TEXT("随着木工技术的发展，工匠们对燕尾榫进行了改进，使其配合更加紧密，结构更加牢固。");
    DovetailMale.ApplicationExamples = TEXT("抽屉面板、箱框等家具的边角连接。");
    DovetailMale.DifficultyLevel = 2;
    DovetailMale.bIsUnlocked = false;
    JointKnowledgeDatabase.Add(DovetailMale);

    FJointKnowledgeData DovetailFemale;
    DovetailFemale.JointName = TEXT("DovetailFemale");
    DovetailFemale.ChineseName = TEXT("燕尾榫凹");
    DovetailFemale.Category = EKnowledgeCategory::KC_JointType;
    DovetailFemale.Description = TEXT("燕尾榫凹是燕尾榫结构中的卯眼部分，形状与榫头相对应，呈倒梯形。制作时需要与榫头精确配合，以保证连接牢固。");
    DovetailFemale.HistoricalContext = TEXT("古代工匠通过长期实践，总结出了一套完整的燕尾榫制作工艺，包括角度计算、尺寸比例等，保证了结构的稳定性。");
    DovetailFemale.ApplicationExamples = TEXT("抽屉侧板、箱框等家具的边角连接。");
    DovetailFemale.DifficultyLevel = 2;
    DovetailFemale.bIsUnlocked = false;
    JointKnowledgeDatabase.Add(DovetailFemale);
}

void UMT_EducationManager::InitializeEducationContent()
{
    EducationContentDatabase.Empty();

    FEducationContent HistoryContent;
    HistoryContent.Title = TEXT("榫卯的历史发展");
    HistoryContent.Category = EKnowledgeCategory::KC_History;
    HistoryContent.Content = TEXT("榫卯技术是中国古代木工技艺的核心，其历史可以追溯到7000多年前的新石器时代。在河姆渡遗址中，考古学家发现了目前已知最早的榫卯结构实物。\n\n春秋战国时期，榫卯技术得到了较大发展，出现了多种榫卯形式。《考工记》中记载了当时的木工技艺，对榫卯的制作工艺进行了详细描述。\n\n唐宋时期是榫卯技术的鼎盛时期，建筑和家具制作中大量使用复杂的榫卯结构，如斗拱、霸王枨等。明清时期，榫卯技术达到了前所未有的高度，出现了大量精美的硬木家具。");
    HistoryContent.ImageReference = TEXT("HistoryTimeline");
    HistoryContent.KeyPoints.Add(TEXT("7000年前河姆渡文化出现最早榫卯"));
    HistoryContent.KeyPoints.Add(TEXT("春秋战国《考工记》记载木工技艺"));
    HistoryContent.KeyPoints.Add(TEXT("唐宋时期榫卯技术鼎盛"));
    HistoryContent.KeyPoints.Add(TEXT("明清硬木家具达到顶峰"));
    EducationContentDatabase.Add(HistoryContent);

    FEducationContent CultureContent;
    CultureContent.Title = TEXT("榫卯的文化意义");
    CultureContent.Category = EKnowledgeCategory::KC_Culture;
    CultureContent.Content = TEXT("榫卯不仅是一种技术，更是中国传统文化的重要载体。它体现了中国人"天人合一"的哲学思想，阴阳平衡的美学观念，以及精益求精的工匠精神。\n\n榫卯结构强调构件之间的相互配合，不使用钉子，完全依靠木材自身的力量实现连接，这与中国传统文化中"和"的思想一脉相承。\n\n在传统观念中，榫卯结构象征着家庭和睦、社会和谐。每一个榫头和卯眼的完美结合，都寓意着人与人之间的和谐共处。");
    CultureContent.ImageReference = TEXT("CultureSymbol");
    CultureContent.KeyPoints.Add(TEXT("体现天人合一哲学思想"));
    CultureContent.KeyPoints.Add(TEXT("阴阳平衡的美学观念"));
    CultureContent.KeyPoints.Add(TEXT("精益求精的工匠精神"));
    CultureContent.KeyPoints.Add(TEXT("象征和谐的文化内涵"));
    EducationContentDatabase.Add(CultureContent);

    FEducationContent ArchitectureContent;
    ArchitectureContent.Title = TEXT("古建筑中的榫卯应用");
    ArchitectureContent.Category = EKnowledgeCategory::KC_Architecture;
    ArchitectureContent.Content = TEXT("中国古代建筑以木结构为主，榫卯技术在其中发挥了至关重要的作用。从宫殿、寺庙到民居，榫卯结构无处不在。\n\n斗拱是中国古代建筑最具代表性的榫卯结构之一。它由多个小构件组合而成，既承担着支撑屋檐的功能，又具有极强的装饰性。在不同的历史时期，斗拱的形式和功能也有所变化。\n\n除了斗拱，古建筑中还使用了大量其他形式的榫卯，如梁架连接、柱础连接等。这些榫卯结构共同构成了中国古代建筑独特的风格。");
    ArchitectureContent.ImageReference = TEXT("AncientBuilding");
    ArchitectureContent.KeyPoints.Add(TEXT("斗拱是代表性榫卯结构"));
    ArchitectureContent.KeyPoints.Add(TEXT("木结构建筑核心技术"));
    ArchitectureContent.KeyPoints.Add(TEXT("兼具结构与装饰功能"));
    ArchitectureContent.KeyPoints.Add(TEXT("梁架柱础多种榫卯形式"));
    EducationContentDatabase.Add(ArchitectureContent);

    FEducationContent CraftContent;
    CraftContent.Title = TEXT("榫卯制作工艺");
    CraftContent.Category = EKnowledgeCategory::KC_Craftsmanship;
    CraftContent.Content = TEXT("榫卯制作是一门需要精湛技艺的工艺。传统工匠制作榫卯时，需要经过选料、开料、划线、制作、打磨等多个环节。\n\n选料是第一步，需要选择质地坚硬、纹理顺直的木材，以确保榫卯的强度和耐用性。开料时要注意木材的纹理方向，避免在受力处出现横纹。\n\n划线是关键步骤，需要使用墨斗、角尺等工具，精确地画出榫头和卯眼的形状和尺寸。传统工匠常说"差之毫厘，谬以千里"，足见划线的重要性。\n\n制作榫卯时，要做到"肩严角正，合缝严密"，榫头和卯眼的配合要松紧适度，既不能太紧导致木材开裂，也不能太松影响结构强度。");
    CraftContent.ImageReference = TEXT("CraftProcess");
    CraftContent.KeyPoints.Add(TEXT("选料开料注重材质纹理"));
    CraftContent.KeyPoints.Add(TEXT("划线精确差之毫厘"));
    CraftContent.KeyPoints.Add(TEXT("肩严角正合缝严密"));
    CraftContent.KeyPoints.Add(TEXT("配合松紧适度"));
    EducationContentDatabase.Add(CraftContent);
}

TArray<FJointKnowledgeData> UMT_EducationManager::GetAllJointKnowledge() const
{
    return JointKnowledgeDatabase;
}

TArray<FJointKnowledgeData> UMT_EducationManager::GetJointKnowledgeByCategory(EKnowledgeCategory Category) const
{
    TArray<FJointKnowledgeData> Result;
    for (const FJointKnowledgeData& Data : JointKnowledgeDatabase)
    {
        if (Data.Category == Category)
        {
            Result.Add(Data);
        }
    }
    return Result;
}

FJointKnowledgeData UMT_EducationManager::GetJointKnowledgeByName(const FString& JointName) const
{
    for (const FJointKnowledgeData& Data : JointKnowledgeDatabase)
    {
        if (Data.JointName == JointName)
        {
            return Data;
        }
    }
    
    FJointKnowledgeData EmptyData;
    EmptyData.JointName = TEXT("");
    EmptyData.ChineseName = TEXT("");
    return EmptyData;
}

void UMT_EducationManager::UnlockJointKnowledge(const FString& JointName)
{
    for (FJointKnowledgeData& Data : JointKnowledgeDatabase)
    {
        if (Data.JointName == JointName)
        {
            Data.bIsUnlocked = true;
            break;
        }
    }
}

void UMT_EducationManager::UnlockKnowledgeByLevel(int32 LevelID)
{
    for (FJointKnowledgeData& Data : JointKnowledgeDatabase)
    {
        if (Data.DifficultyLevel <= LevelID)
        {
            Data.bIsUnlocked = true;
        }
    }
}

TArray<FEducationContent> UMT_EducationManager::GetEducationContentByCategory(EKnowledgeCategory Category) const
{
    TArray<FEducationContent> Result;
    for (const FEducationContent& Content : EducationContentDatabase)
    {
        if (Content.Category == Category)
        {
            Result.Add(Content);
        }
    }
    return Result;
}

FEducationContent UMT_EducationManager::GetEducationContent(const FString& Title) const
{
    for (const FEducationContent& Content : EducationContentDatabase)
    {
        if (Content.Title == Title)
        {
            return Content;
        }
    }
    
    FEducationContent EmptyContent;
    EmptyContent.Title = TEXT("");
    return EmptyContent;
}

int32 UMT_EducationManager::GetUnlockedKnowledgeCount() const
{
    int32 Count = 0;
    for (const FJointKnowledgeData& Data : JointKnowledgeDatabase)
    {
        if (Data.bIsUnlocked)
        {
            Count++;
        }
    }
    return Count;
}

float UMT_EducationManager::GetKnowledgeProgress() const
{
    if (JointKnowledgeDatabase.Num() == 0)
    {
        return 0.0f;
    }
    
    return static_cast<float>(GetUnlockedKnowledgeCount()) / static_cast<float>(JointKnowledgeDatabase.Num());
}
