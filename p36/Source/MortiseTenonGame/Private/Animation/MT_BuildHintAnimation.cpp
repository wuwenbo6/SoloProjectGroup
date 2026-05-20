#include "Animation/MT_BuildHintAnimation.h"
#include "Components/StaticMeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "MortiseTenon/MT_MortiseTenonPart.h"

UMT_BuildHintAnimation::UMT_BuildHintAnimation()
{
    PrimaryComponentTick.bCanEverTick = true;
    GuideColor = FLinearColor(0.0f, 0.8f, 1.0f, 0.8f);
    SuccessColor = FLinearColor(0.0f, 1.0f, 0.4f, 1.0f);
    AnimationSpeed = 1.0f;
    HighlightMaterial = nullptr;
    PulseRadius = 0.0f;
}

void UMT_BuildHintAnimation::BeginPlay()
{
    Super::BeginPlay();
}

void UMT_BuildHintAnimation::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    float ScaledDelta = DeltaTime * AnimationSpeed;

    UpdatePositionGuide(ScaledDelta);
    UpdateRotationGuide(ScaledDelta);
    UpdateSnapIndicator(ScaledDelta);
    UpdateSuccessEffect(ScaledDelta);
    UpdatePartHighlight(ScaledDelta);
    UpdateConnectorPulse(ScaledDelta);
}

void UMT_BuildHintAnimation::StartPositionGuide(const FVector& TargetPosition, float Duration)
{
    FAnimationState State;
    State.bIsPlaying = true;
    State.ElapsedTime = 0.0f;
    State.TotalDuration = Duration;
    State.TargetVector = TargetPosition;
    State.CurrentAlpha = 0.0f;

    AnimationStates.Add(EHintAnimationType::HAT_PositionGuide, State);
    OnHintAnimationStarted.Broadcast(EHintAnimationType::HAT_PositionGuide);
}

void UMT_BuildHintAnimation::StartRotationGuide(const FRotator& TargetRotation, float Duration)
{
    FAnimationState State;
    State.bIsPlaying = true;
    State.ElapsedTime = 0.0f;
    State.TotalDuration = Duration;
    State.TargetRotator = TargetRotation;
    State.CurrentAlpha = 0.0f;

    AnimationStates.Add(EHintAnimationType::HAT_RotationGuide, State);
    OnHintAnimationStarted.Broadcast(EHintAnimationType::HAT_RotationGuide);
}

void UMT_BuildHintAnimation::StartSnapIndicator(float Duration)
{
    FAnimationState State;
    State.bIsPlaying = true;
    State.ElapsedTime = 0.0f;
    State.TotalDuration = Duration;
    State.CurrentAlpha = 0.0f;

    AnimationStates.Add(EHintAnimationType::HAT_SnapIndicator, State);
    OnHintAnimationStarted.Broadcast(EHintAnimationType::HAT_SnapIndicator);
}

void UMT_BuildHintAnimation::StartSuccessEffect(float Duration)
{
    FAnimationState State;
    State.bIsPlaying = true;
    State.ElapsedTime = 0.0f;
    State.TotalDuration = Duration;
    State.CurrentAlpha = 0.0f;

    AnimationStates.Add(EHintAnimationType::HAT_SuccessEffect, State);
    OnHintAnimationStarted.Broadcast(EHintAnimationType::HAT_SuccessEffect);
}

void UMT_BuildHintAnimation::StartPartHighlight(float Intensity, float Duration)
{
    FAnimationState State;
    State.bIsPlaying = true;
    State.ElapsedTime = 0.0f;
    State.TotalDuration = Duration;
    State.CurrentAlpha = Intensity;

    AnimationStates.Add(EHintAnimationType::HAT_PartHighlight, State);
    OnHintAnimationStarted.Broadcast(EHintAnimationType::HAT_PartHighlight);
}

void UMT_BuildHintAnimation::StartConnectorPulse(const FVector& ConnectorLocation, float Duration)
{
    FAnimationState State;
    State.bIsPlaying = true;
    State.ElapsedTime = 0.0f;
    State.TotalDuration = Duration;
    State.TargetVector = ConnectorLocation;
    State.CurrentAlpha = 0.0f;

    ConnectorPulseLocation = ConnectorLocation;
    AnimationStates.Add(EHintAnimationType::HAT_ConnectorPulse, State);
    OnHintAnimationStarted.Broadcast(EHintAnimationType::HAT_ConnectorPulse);
}

void UMT_BuildHintAnimation::StopAllAnimations()
{
    TArray<EHintAnimationType> Types;
    AnimationStates.GetKeys(Types);

    for (EHintAnimationType Type : Types)
    {
        OnHintAnimationFinished.Broadcast(Type);
    }
    AnimationStates.Empty();
}

bool UMT_BuildHintAnimation::IsAnimationPlaying(EHintAnimationType Type) const
{
    const FAnimationState* State = AnimationStates.Find(Type);
    return State && State->bIsPlaying;
}

float UMT_BuildHintAnimation::GetCurrentAnimationProgress(EHintAnimationType Type) const
{
    const FAnimationState* State = AnimationStates.Find(Type);
    if (State && State->TotalDuration > 0.0f)
    {
        return State->ElapsedTime / State->TotalDuration;
    }
    return 0.0f;
}

void UMT_BuildHintAnimation::UpdatePositionGuide(float DeltaTime)
{
    FAnimationState* State = AnimationStates.Find(EHintAnimationType::HAT_PositionGuide);
    if (!State || !State->bIsPlaying) return;

    State->ElapsedTime += DeltaTime;
    float Progress = FMath::Clamp(State->ElapsedTime / State->TotalDuration, 0.0f, 1.0f);
    State->CurrentAlpha = FMath::Sin(Progress * PI);

    if (Progress >= 1.0f)
    {
        State->bIsPlaying = false;
        OnHintAnimationFinished.Broadcast(EHintAnimationType::HAT_PositionGuide);
        AnimationStates.Remove(EHintAnimationType::HAT_PositionGuide);
    }
}

void UMT_BuildHintAnimation::UpdateRotationGuide(float DeltaTime)
{
    FAnimationState* State = AnimationStates.Find(EHintAnimationType::HAT_RotationGuide);
    if (!State || !State->bIsPlaying) return;

    State->ElapsedTime += DeltaTime;
    float Progress = FMath::Clamp(State->ElapsedTime / State->TotalDuration, 0.0f, 1.0f);
    State->CurrentAlpha = FMath::Sin(Progress * PI * 2.0f);

    if (Progress >= 1.0f)
    {
        State->bIsPlaying = false;
        OnHintAnimationFinished.Broadcast(EHintAnimationType::HAT_RotationGuide);
        AnimationStates.Remove(EHintAnimationType::HAT_RotationGuide);
    }
}

void UMT_BuildHintAnimation::UpdateSnapIndicator(float DeltaTime)
{
    FAnimationState* State = AnimationStates.Find(EHintAnimationType::HAT_SnapIndicator);
    if (!State || !State->bIsPlaying) return;

    State->ElapsedTime += DeltaTime;
    float Progress = FMath::Clamp(State->ElapsedTime / State->TotalDuration, 0.0f, 1.0f);
    State->CurrentAlpha = 1.0f - FMath::Pow(Progress, 2.0f);

    if (Progress >= 1.0f)
    {
        State->bIsPlaying = false;
        OnHintAnimationFinished.Broadcast(EHintAnimationType::HAT_SnapIndicator);
        AnimationStates.Remove(EHintAnimationType::HAT_SnapIndicator);
    }
}

void UMT_BuildHintAnimation::UpdateSuccessEffect(float DeltaTime)
{
    FAnimationState* State = AnimationStates.Find(EHintAnimationType::HAT_SuccessEffect);
    if (!State || !State->bIsPlaying) return;

    State->ElapsedTime += DeltaTime;
    float Progress = FMath::Clamp(State->ElapsedTime / State->TotalDuration, 0.0f, 1.0f);
    
    if (Progress < 0.3f)
    {
        State->CurrentAlpha = Progress / 0.3f;
    }
    else if (Progress > 0.7f)
    {
        State->CurrentAlpha = (1.0f - Progress) / 0.3f;
    }
    else
    {
        State->CurrentAlpha = 1.0f;
    }

    if (Progress >= 1.0f)
    {
        State->bIsPlaying = false;
        OnHintAnimationFinished.Broadcast(EHintAnimationType::HAT_SuccessEffect);
        AnimationStates.Remove(EHintAnimationType::HAT_SuccessEffect);
    }
}

void UMT_BuildHintAnimation::UpdatePartHighlight(float DeltaTime)
{
    FAnimationState* State = AnimationStates.Find(EHintAnimationType::HAT_PartHighlight);
    if (!State || !State->bIsPlaying) return;

    State->ElapsedTime += DeltaTime;
    float Progress = FMath::Clamp(State->ElapsedTime / State->TotalDuration, 0.0f, 1.0f);
    
    float BaseAlpha = State->CurrentAlpha;
    float PulseFactor = 0.5f + 0.5f * FMath::Sin(Progress * PI * 4.0f);

    AMT_MortiseTenonPart* OwnerPart = Cast<AMT_MortiseTenonPart>(GetOwner());
    if (OwnerPart && OwnerPart->MeshComponent)
    {
        if (!HighlightMaterial)
        {
            UMaterialInterface* BaseMaterial = OwnerPart->MeshComponent->GetMaterial(0);
            if (BaseMaterial)
            {
                HighlightMaterial = UMaterialInstanceDynamic::Create(BaseMaterial, OwnerPart);
                OwnerPart->MeshComponent->SetMaterial(0, HighlightMaterial);
            }
        }
        
        if (HighlightMaterial)
        {
            HighlightMaterial->SetScalarParameterValue(TEXT("HighlightIntensity"), BaseAlpha * PulseFactor);
        }
    }

    if (Progress >= 1.0f)
    {
        State->bIsPlaying = false;
        OnHintAnimationFinished.Broadcast(EHintAnimationType::HAT_PartHighlight);
        AnimationStates.Remove(EHintAnimationType::HAT_PartHighlight);
    }
}

void UMT_BuildHintAnimation::UpdateConnectorPulse(float DeltaTime)
{
    FAnimationState* State = AnimationStates.Find(EHintAnimationType::HAT_ConnectorPulse);
    if (!State || !State->bIsPlaying) return;

    State->ElapsedTime += DeltaTime;
    float Progress = FMath::Clamp(State->ElapsedTime / State->TotalDuration, 0.0f, 1.0f);
    
    PulseRadius = 5.0f + Progress * 20.0f;
    State->CurrentAlpha = FMath::Sin(Progress * PI * 3.0f);

    if (Progress >= 1.0f)
    {
        State->bIsPlaying = false;
        OnHintAnimationFinished.Broadcast(EHintAnimationType::HAT_ConnectorPulse);
        AnimationStates.Remove(EHintAnimationType::HAT_ConnectorPulse);
    }
}
