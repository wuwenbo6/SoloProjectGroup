#pragma once

#include "CoreMinimal.h"
#include "Components/SceneComponent.h"
#include "MT_PhysicsInteractionComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnJointSnapped, class UMT_PhysicsInteractionComponent*, SnappedComponent);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnForceExceeded, float, ForceMagnitude);

UENUM(BlueprintType)
enum class EJointType : uint8
{
    JT_Dovetail UMETA(DisplayName = "燕尾榫"),
    JT_Tenon UMETA(DisplayName = "榫卯"),
    JT_Mortise UMETA(DisplayName = "卯眼"),
    JT_Dowel UMETA(DisplayName = "销钉"),
    JT_DovetailMale UMETA(DisplayName = "燕尾榫凸"),
    JT_DovetailFemale UMETA(DisplayName = "燕尾榫凹"),
    JT_Bracket UMETA(DisplayName = "斗拱")
};

UCLASS( ClassGroup=(Custom), meta=(BlueprintSpawnableComponent) )
class MORTISETENONGAME_API UMT_PhysicsInteractionComponent : public USceneComponent
{
    GENERATED_BODY()

public:
    UMT_PhysicsInteractionComponent();

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UFUNCTION(BlueprintCallable, Category = "榫卯物理")
    void SetCanSnap(bool bNewCanSnap) { bCanSnap = bNewCanSnap; }

    UFUNCTION(BlueprintCallable, Category = "榫卯物理")
    bool GetCanSnap() const { return bCanSnap; }

    UFUNCTION(BlueprintCallable, Category = "榫卯物理")
    void SetJointType(EJointType NewJointType) { JointType = NewJointType; }

    UFUNCTION(BlueprintCallable, Category = "榫卯物理")
    EJointType GetJointType() const { return JointType; }

    UFUNCTION(BlueprintCallable, Category = "榫卯物理")
    void SetMatchingJointType(EJointType NewMatchingType) { MatchingJointType = NewMatchingType; }

    UFUNCTION(BlueprintCallable, Category = "榫卯物理")
    void ApplyForceToJoint(const FVector& Force);

    UFUNCTION(BlueprintCallable, Category = "榫卯物理")
    bool IsSnapped() const { return bIsSnapped; }

    UFUNCTION(BlueprintCallable, Category = "榫卯物理")
    void ReleaseJoint();

    UPROPERTY(BlueprintAssignable, Category = "榫卯事件")
    FOnJointSnapped OnJointSnapped;

    UPROPERTY(BlueprintAssignable, Category = "榫卯事件")
    FOnForceExceeded OnForceExceeded;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯物理")
    float SnapDistanceThreshold;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯物理")
    float SnapAngleThreshold;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯物理")
    float MaxForceBeforeBreak;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯物理")
    float JointFriction;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯物理")
    EJointType JointType;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯物理")
    EJointType MatchingJointType;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯物理")
    bool bUseCCD;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯物理")
    float PenetrationCorrectionStrength;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "手感优化", meta = (ClampMin = "0.1", ClampMax = "5.0"))
    float MovementSmoothness;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "手感优化", meta = (ClampMin = "0.1", ClampMax = "5.0"))
    float RotationSmoothness;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "手感优化", meta = (ClampMin = "0.0", ClampMax = "10.0"))
    float LinearDamping;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "手感优化", meta = (ClampMin = "0.0", ClampMax = "10.0"))
    float AngularDamping;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "手感优化")
    bool bUseVelocityPrediction;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "手感优化")
    float SnapAssistStrength;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "手感优化")
    float GravityScale;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "手感优化")
    float MaxAngularVelocity;

    UFUNCTION(BlueprintCallable, Category = "手感优化")
    void SetMovementSmoothness(float NewSmoothness) { MovementSmoothness = NewSmoothness; }

    UFUNCTION(BlueprintCallable, Category = "手感优化")
    void SetLinearDamping(float NewDamping) { LinearDamping = NewDamping; }

    UFUNCTION(BlueprintCallable, Category = "手感优化")
    void SetGravityScale(float NewScale) { GravityScale = NewScale; }

protected:
    virtual void BeginPlay() override;

private:
    void CheckForSnap();
    void UpdatePhysicsSimulation(float DeltaTime);
    void ApplyFriction();
    bool CheckJointCompatibility(UMT_PhysicsInteractionComponent* OtherComponent);
    void CorrectPenetration(UPrimitiveComponent* Comp);
    void SetupCollisionProperties();
    void ApplySmoothDamping(float DeltaTime);
    void ApplySnapAssist();
    void LimitVelocity();
    void PredictVelocity(float DeltaTime);
    UPrimitiveComponent* GetOwnerPrimitive() const;

    bool bCanSnap;
    bool bIsSnapped;
    TWeakObjectPtr<UMT_PhysicsInteractionComponent> SnappedPartner;
    TWeakObjectPtr<UPhysicsConstraintComponent> ActiveConstraint;
    FVector AccumulatedForce;
    FVector PreviousVelocity;
    FVector TargetPosition;
    FRotator TargetRotation;
    bool bHasTargetPosition;
    bool bHasTargetRotation;
};
