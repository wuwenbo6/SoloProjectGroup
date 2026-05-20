#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "MT_BuildHintAnimation.generated.h"

UENUM(BlueprintType)
enum class EHintAnimationType : uint8
{
    HAT_PositionGuide UMETA(DisplayName = "位置引导"),
    HAT_RotationGuide UMETA(DisplayName = "旋转引导"),
    HAT_SnapIndicator UMETA(DisplayName = "吸附指示器"),
    HAT_SuccessEffect UMETA(DisplayName = "成功特效"),
    HAT_PartHighlight UMETA(DisplayName = "部件高亮"),
    HAT_ConnectorPulse UMETA(DisplayName = "连接点脉冲")
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnHintAnimationStarted, EHintAnimationType, AnimationType);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnHintAnimationFinished, EHintAnimationType, AnimationType);

UCLASS( ClassGroup=(Custom), meta=(BlueprintSpawnableComponent) )
class MORTISETENONGAME_API UMT_BuildHintAnimation : public UActorComponent
{
    GENERATED_BODY()

public:
    UMT_BuildHintAnimation();

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UFUNCTION(BlueprintCallable, Category = "榫卯动画")
    void StartPositionGuide(const FVector& TargetPosition, float Duration = 2.0f);

    UFUNCTION(BlueprintCallable, Category = "榫卯动画")
    void StartRotationGuide(const FRotator& TargetRotation, float Duration = 2.0f);

    UFUNCTION(BlueprintCallable, Category = "榫卯动画")
    void StartSnapIndicator(float Duration = 1.5f);

    UFUNCTION(BlueprintCallable, Category = "榫卯动画")
    void StartSuccessEffect(float Duration = 2.0f);

    UFUNCTION(BlueprintCallable, Category = "榫卯动画")
    void StartPartHighlight(float Intensity = 2.0f, float Duration = 3.0f);

    UFUNCTION(BlueprintCallable, Category = "榫卯动画")
    void StartConnectorPulse(const FVector& ConnectorLocation, float Duration = 3.0f);

    UFUNCTION(BlueprintCallable, Category = "榫卯动画")
    void StopAllAnimations();

    UFUNCTION(BlueprintCallable, Category = "榫卯动画")
    bool IsAnimationPlaying(EHintAnimationType Type) const;

    UPROPERTY(BlueprintAssignable, Category = "榫卯动画事件")
    FOnHintAnimationStarted OnHintAnimationStarted;

    UPROPERTY(BlueprintAssignable, Category = "榫卯动画事件")
    FOnHintAnimationFinished OnHintAnimationFinished;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯动画")
    FLinearColor GuideColor;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯动画")
    FLinearColor SuccessColor;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯动画")
    float AnimationSpeed;

    UFUNCTION(BlueprintCallable, Category = "榫卯动画")
    float GetCurrentAnimationProgress(EHintAnimationType Type) const;

protected:
    virtual void BeginPlay() override;

private:
    struct FAnimationState
    {
        bool bIsPlaying;
        float ElapsedTime;
        float TotalDuration;
        FVector TargetVector;
        FRotator TargetRotator;
        float CurrentAlpha;
    };

    TMap<EHintAnimationType, FAnimationState> AnimationStates;

    void UpdatePositionGuide(float DeltaTime);
    void UpdateRotationGuide(float DeltaTime);
    void UpdateSnapIndicator(float DeltaTime);
    void UpdateSuccessEffect(float DeltaTime);
    void UpdatePartHighlight(float DeltaTime);
    void UpdateConnectorPulse(float DeltaTime);

    UPROPERTY()
    class UMaterialInstanceDynamic* HighlightMaterial;

    FVector ConnectorPulseLocation;
    float PulseRadius;
};
