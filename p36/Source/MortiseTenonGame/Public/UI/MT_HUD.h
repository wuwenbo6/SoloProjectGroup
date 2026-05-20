#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "MT_HUD.generated.h"

UENUM(BlueprintType)
enum class EUIState : uint8
{
    UI_MainMenu UMETA(DisplayName = "主菜单"),
    UI_LevelSelect UMETA(DisplayName = "关卡选择"),
    UI_GameHUD UMETA(DisplayName = "游戏界面"),
    UI_PauseMenu UMETA(DisplayName = "暂停菜单"),
    UI_LevelComplete UMETA(DisplayName = "关卡完成"),
    UI_Education UMETA(DisplayName = "教育讲解")
};

UENUM(BlueprintType)
enum class EHintType : uint8
{
    HT_General UMETA(DisplayName = "通用提示"),
    HT_Position UMETA(DisplayName = "位置提示"),
    HT_Rotation UMETA(DisplayName = "旋转提示"),
    HT_JointType UMETA(DisplayName = "榫卯类型提示"),
    HT_Progression UMETA(DisplayName = "进度提示")
};

USTRUCT(BlueprintType)
struct FHintData
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "榫卯UI")
    FString HintText;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯UI")
    EHintType HintType;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯UI")
    float DisplayDuration;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯UI")
    bool bIsImportant;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnHintUpdated, const FString&, HintText);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnProgressUpdated, float, Progress);

UCLASS()
class MORTISETENONGAME_API AMT_HUD : public AHUD
{
    GENERATED_BODY()

public:
    AMT_HUD();

    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

    UFUNCTION(BlueprintCallable, Category = "榫卯UI")
    void ShowMainMenu();

    UFUNCTION(BlueprintCallable, Category = "榫卯UI")
    void ShowLevelSelect();

    UFUNCTION(BlueprintCallable, Category = "榫卯UI")
    void ShowGameHUD();

    UFUNCTION(BlueprintCallable, Category = "榫卯UI")
    void ShowPauseMenu();

    UFUNCTION(BlueprintCallable, Category = "榫卯UI")
    void ShowLevelComplete();

    UFUNCTION(BlueprintCallable, Category = "榫卯UI")
    void ShowEducationPanel();

    UFUNCTION(BlueprintCallable, Category = "榫卯UI")
    void HideAllWidgets();

    UFUNCTION(BlueprintCallable, Category = "榫卯UI")
    void UpdateLevelProgress(float Progress);

    UFUNCTION(BlueprintCallable, Category = "榫卯UI")
    void UpdateHintCount(int32 RemainingHints);

    UFUNCTION(BlueprintCallable, Category = "榫卯UI")
    void ShowHintMessage(const FString& HintText, float Duration = 3.0f);

    UFUNCTION(BlueprintCallable, Category = "榫卯UI")
    void HideHintMessage();

    UFUNCTION(BlueprintCallable, Category = "榫卯UI")
    void ShowPartHint(class AMT_MortiseTenonPart* Part);

    UFUNCTION(BlueprintCallable, Category = "榫卯UI")
    void ShowGeneralHint();

    UFUNCTION(BlueprintCallable, Category = "榫卯UI")
    EUIState GetCurrentUIState() const { return CurrentUIState; }

    UFUNCTION(BlueprintCallable, Category = "榫卯UI")
    FString GetCurrentHint() const { return CurrentHint; }

    UPROPERTY(BlueprintAssignable, Category = "榫卯UI事件")
    FOnHintUpdated OnHintUpdated;

    UPROPERTY(BlueprintAssignable, Category = "榫卯UI事件")
    FOnProgressUpdated OnProgressUpdated;

protected:
    UPROPERTY(EditAnywhere, Category = "榫卯UI")
    TSubclassOf<class UUserWidget> MainMenuWidgetClass;

    UPROPERTY(EditAnywhere, Category = "榫卯UI")
    TSubclassOf<class UUserWidget> LevelSelectWidgetClass;

    UPROPERTY(EditAnywhere, Category = "榫卯UI")
    TSubclassOf<class UUserWidget> GameHUDWidgetClass;

    UPROPERTY(EditAnywhere, Category = "榫卯UI")
    TSubclassOf<class UUserWidget> PauseMenuWidgetClass;

    UPROPERTY(EditAnywhere, Category = "榫卯UI")
    TSubclassOf<class UUserWidget> LevelCompleteWidgetClass;

    UPROPERTY(EditAnywhere, Category = "榫卯UI")
    TSubclassOf<class UUserWidget> EducationWidgetClass;

private:
    void CreateWidgetIfNeeded(TSubclassOf<UUserWidget> WidgetClass, UUserWidget*& Widget);
    void SafeRemoveWidget(UUserWidget* Widget);
    void OnHintTimeout();
    FString GeneratePositionHint(AMT_MortiseTenonPart* Part) const;
    FString GenerateRotationHint(AMT_MortiseTenonPart* Part) const;
    FString GenerateJointTypeHint(AMT_MortiseTenonPart* Part) const;
    FString GenerateProgressionHint() const;
    
    UUserWidget* MainMenuWidget;
    UUserWidget* LevelSelectWidget;
    UUserWidget* GameHUDWidget;
    UUserWidget* PauseMenuWidget;
    UUserWidget* LevelCompleteWidget;
    UUserWidget* EducationWidget;
    
    EUIState CurrentUIState;
    FString CurrentHint;
    FTimerHandle HintTimerHandle;
    float CurrentProgress;
};
