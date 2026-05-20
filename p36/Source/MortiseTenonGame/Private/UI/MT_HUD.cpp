#include "UI/MT_HUD.h"
#include "Blueprint/UserWidget.h"
#include "MortiseTenon/MT_MortiseTenonPart.h"
#include "Kismet/GameplayStatics.h"
#include "Game/MT_GameMode.h"

AMT_HUD::AMT_HUD()
{
    PrimaryActorTick.bCanEverTick = false;
    MainMenuWidget = nullptr;
    LevelSelectWidget = nullptr;
    GameHUDWidget = nullptr;
    PauseMenuWidget = nullptr;
    LevelCompleteWidget = nullptr;
    EducationWidget = nullptr;
    CurrentUIState = EUIState::UI_MainMenu;
    CurrentHint = TEXT("");
    CurrentProgress = 0.0f;
}

void AMT_HUD::BeginPlay()
{
    Super::BeginPlay();
}

void AMT_HUD::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    Super::EndPlay(EndPlayReason);
    
    GetWorld()->GetTimerManager().ClearTimer(HintTimerHandle);
    
    HideAllWidgets();
}

void AMT_HUD::ShowMainMenu()
{
    HideAllWidgets();
    CreateWidgetIfNeeded(MainMenuWidgetClass, MainMenuWidget);
    
    if (MainMenuWidget)
    {
        MainMenuWidget->AddToViewport(10);
        CurrentUIState = EUIState::UI_MainMenu;
    }
}

void AMT_HUD::ShowLevelSelect()
{
    HideAllWidgets();
    CreateWidgetIfNeeded(LevelSelectWidgetClass, LevelSelectWidget);
    
    if (LevelSelectWidget)
    {
        LevelSelectWidget->AddToViewport(10);
        CurrentUIState = EUIState::UI_LevelSelect;
    }
}

void AMT_HUD::ShowGameHUD()
{
    HideAllWidgets();
    CreateWidgetIfNeeded(GameHUDWidgetClass, GameHUDWidget);
    
    if (GameHUDWidget)
    {
        GameHUDWidget->AddToViewport(10);
        CurrentUIState = EUIState::UI_GameHUD;
    }
}

void AMT_HUD::ShowPauseMenu()
{
    CreateWidgetIfNeeded(PauseMenuWidgetClass, PauseMenuWidget);
    
    if (PauseMenuWidget)
    {
        PauseMenuWidget->AddToViewport(50);
        CurrentUIState = EUIState::UI_PauseMenu;
    }
}

void AMT_HUD::ShowLevelComplete()
{
    HideAllWidgets();
    CreateWidgetIfNeeded(LevelCompleteWidgetClass, LevelCompleteWidget);
    
    if (LevelCompleteWidget)
    {
        LevelCompleteWidget->AddToViewport(100);
        CurrentUIState = EUIState::UI_LevelComplete;
    }
}

void AMT_HUD::ShowEducationPanel()
{
    CreateWidgetIfNeeded(EducationWidgetClass, EducationWidget);
    
    if (EducationWidget)
    {
        EducationWidget->AddToViewport(100);
        CurrentUIState = EUIState::UI_Education;
    }
}

void AMT_HUD::HideAllWidgets()
{
    GetWorld()->GetTimerManager().ClearTimer(HintTimerHandle);
    
    SafeRemoveWidget(MainMenuWidget);
    SafeRemoveWidget(LevelSelectWidget);
    SafeRemoveWidget(GameHUDWidget);
    SafeRemoveWidget(PauseMenuWidget);
    SafeRemoveWidget(LevelCompleteWidget);
    SafeRemoveWidget(EducationWidget);
}

void AMT_HUD::SafeRemoveWidget(UUserWidget* Widget)
{
    if (Widget && IsValid(Widget))
    {
        if (Widget->IsInViewport())
        {
            Widget->RemoveFromViewport();
        }
    }
}

void AMT_HUD::UpdateLevelProgress(float Progress)
{
    CurrentProgress = FMath::Clamp(Progress, 0.0f, 1.0f);
    OnProgressUpdated.Broadcast(CurrentProgress);
}

void AMT_HUD::UpdateHintCount(int32 RemainingHints)
{
}

void AMT_HUD::ShowHintMessage(const FString& HintText, float Duration)
{
    if (HintText.IsEmpty())
    {
        return;
    }

    CurrentHint = HintText;
    OnHintUpdated.Broadcast(CurrentHint);
    
    GetWorld()->GetTimerManager().ClearTimer(HintTimerHandle);
    
    if (Duration > 0.0f)
    {
        GetWorld()->GetTimerManager().SetTimer(HintTimerHandle, this, &AMT_HUD::OnHintTimeout, Duration, false);
    }
}

void AMT_HUD::HideHintMessage()
{
    GetWorld()->GetTimerManager().ClearTimer(HintTimerHandle);
    CurrentHint = TEXT("");
    OnHintUpdated.Broadcast(CurrentHint);
}

void AMT_HUD::OnHintTimeout()
{
    HideHintMessage();
}

void AMT_HUD::ShowPartHint(AMT_MortiseTenonPart* Part)
{
    if (!Part || !IsValid(Part))
    {
        return;
    }

    FString HintText;
    
    float DistanceToTarget = FVector::Dist(Part->GetActorLocation(), Part->TargetPosition);
    FRotator RotationDiff = Part->GetActorRotation() - Part->TargetRotation;
    float RotationDistance = FMath::Abs(RotationDiff.Pitch) + FMath::Abs(RotationDiff.Yaw) + FMath::Abs(RotationDiff.Roll);
    
    if (DistanceToTarget > 200.0f)
    {
        HintText = GeneratePositionHint(Part);
    }
    else if (RotationDistance > 30.0f)
    {
        HintText = GenerateRotationHint(Part);
    }
    else if (DistanceToTarget > 50.0f)
    {
        HintText = FString::Printf(TEXT("已接近目标位置！继续微调部件位置至目标区域。当前距离: %.1fcm"), DistanceToTarget);
    }
    else
    {
        HintText = GenerateJointTypeHint(Part);
    }

    ShowHintMessage(HintText, 5.0f);
}

void AMT_HUD::ShowGeneralHint()
{
    FString HintText = GenerateProgressionHint();
    ShowHintMessage(HintText, 4.0f);
}

FString AMT_HUD::GeneratePositionHint(AMT_MortiseTenonPart* Part) const
{
    if (!Part)
    {
        return TEXT("请选择一个部件进行操作。");
    }

    FVector CurrentPos = Part->GetActorLocation();
    FVector TargetPos = Part->TargetPosition;
    FVector Direction = (TargetPos - CurrentPos).GetSafeNormal();
    
    FString DirectionHint;
    if (FMath::Abs(Direction.X) > FMath::Abs(Direction.Y) && FMath::Abs(Direction.X) > FMath::Abs(Direction.Z))
    {
        DirectionHint = Direction.X > 0 ? TEXT("向前") : TEXT("向后");
    }
    else if (FMath::Abs(Direction.Y) > FMath::Abs(Direction.Z))
    {
        DirectionHint = Direction.Y > 0 ? TEXT("向右") : TEXT("向左");
    }
    else
    {
        DirectionHint = Direction.Z > 0 ? TEXT("向上") : TEXT("向下");
    }

    float Distance = FVector::Dist(CurrentPos, TargetPos);
    return FString::Printf(TEXT("请将部件%s移动至目标位置。当前距离: %.1fcm"), *DirectionHint, Distance);
}

FString AMT_HUD::GenerateRotationHint(AMT_MortiseTenonPart* Part) const
{
    if (!Part)
    {
        return TEXT("");
    }

    FRotator CurrentRot = Part->GetActorRotation();
    FRotator TargetRot = Part->TargetRotation;
    FRotator Diff = TargetRot - CurrentRot;
    
    TArray<FString> RotationHints;
    
    if (FMath::Abs(Diff.Pitch) > 10.0f)
    {
        RotationHints.Add(Diff.Pitch > 0 ? TEXT("绕X轴正向旋转") : TEXT("绕X轴反向旋转"));
    }
    if (FMath::Abs(Diff.Yaw) > 10.0f)
    {
        RotationHints.Add(Diff.Yaw > 0 ? TEXT("绕Y轴正向旋转") : TEXT("绕Y轴反向旋转"));
    }
    if (FMath::Abs(Diff.Roll) > 10.0f)
    {
        RotationHints.Add(Diff.Roll > 0 ? TEXT("绕Z轴正向旋转") : TEXT("绕Z轴反向旋转"));
    }

    if (RotationHints.Num() > 0)
    {
        FString CombinedHints;
        for (int32 i = 0; i < RotationHints.Num(); ++i)
        {
            if (i > 0) CombinedHints += TEXT("、");
            CombinedHints += RotationHints[i];
        }
        return FString::Printf(TEXT("建议%s以匹配目标角度。"), *CombinedHints);
    }
    
    return TEXT("角度已大致对齐，请继续微调位置！");
}

FString AMT_HUD::GenerateJointTypeHint(AMT_MortiseTenonPart* Part) const
{
    if (!Part || !Part->PhysicsComponent)
    {
        return TEXT("位置已对齐！请确保与对应榫卯部件准确对接。");
    }

    FString JointTypeName;
    switch (Part->PhysicsComponent->JointType)
    {
        case EJointType::JT_Dovetail:
            JointTypeName = TEXT("燕尾榫");
            break;
        case EJointType::JT_Tenon:
            JointTypeName = TEXT("榫头");
            break;
        case EJointType::JT_Mortise:
            JointTypeName = TEXT("卯眼");
            break;
        case EJointType::JT_Dowel:
            JointTypeName = TEXT("销钉");
            break;
        case EJointType::JT_DovetailMale:
            JointTypeName = TEXT("燕尾榫凸");
            break;
        case EJointType::JT_DovetailFemale:
            JointTypeName = TEXT("燕尾榫凹");
            break;
        case EJointType::JT_Bracket:
            JointTypeName = TEXT("斗拱");
            break;
        default:
            JointTypeName = TEXT("");
            break;
    }

    if (!JointTypeName.IsEmpty())
    {
        return FString::Printf(TEXT("这是%s部件，请找到匹配的%s部件进行对接！"), *JointTypeName, *JointTypeName);
    }
    
    return TEXT("位置已对齐！请与对应部件对接完成拼接。");
}

FString AMT_HUD::GenerateProgressionHint() const
{
    TArray<FString> Hints;
    Hints.Add(TEXT("提示：使用WASD键移动选中的部件，Q/E键旋转部件"));
    Hints.Add(TEXT("提示：点击部件可以选中它，再次点击或右键取消选择"));
    Hints.Add(TEXT("提示：观察目标位置的半透明预览，将部件移动到正确位置"));
    Hints.Add(TEXT("提示：榫卯结构需要精确对齐，耐心调整角度和位置"));
    Hints.Add(TEXT("提示：每个部件都有对应的匹配部件，注意形状匹配"));
    Hints.Add(TEXT("提示：放置部件后会自动启用物理模拟，确保对齐后再放置"));
    
    int32 RandomIndex = FMath::RandRange(0, Hints.Num() - 1);
    return Hints[RandomIndex];
}

void AMT_HUD::CreateWidgetIfNeeded(TSubclassOf<UUserWidget> WidgetClass, UUserWidget*& Widget)
{
    if (!Widget && WidgetClass)
    {
        Widget = CreateWidget<UUserWidget>(GetWorld(), WidgetClass);
    }
}
