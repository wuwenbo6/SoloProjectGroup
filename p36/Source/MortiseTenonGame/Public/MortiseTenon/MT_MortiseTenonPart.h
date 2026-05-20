#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Physics/MT_PhysicsInteractionComponent.h"
#include "MT_MortiseTenonPart.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnPartPlaced);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnPartSelected);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnPartDeselected);

UENUM(BlueprintType)
enum class EPartDifficulty : uint8
{
    PD_Beginner UMETA(DisplayName = "入门"),
    PD_Easy UMETA(DisplayName = "简单"),
    PD_Medium UMETA(DisplayName = "中等"),
    PD_Hard UMETA(DisplayName = "困难"),
    PD_Expert UMETA(DisplayName = "专家")
};

UCLASS()
class MORTISETENONGAME_API AMT_MortiseTenonPart : public AActor
{
    GENERATED_BODY()

public:
    AMT_MortiseTenonPart();

    virtual void Tick(float DeltaTime) override;

    UFUNCTION(BlueprintCallable, Category = "榫卯部件")
    void SelectPart();

    UFUNCTION(BlueprintCallable, Category = "榫卯部件")
    void DeselectPart();

    UFUNCTION(BlueprintCallable, Category = "榫卯部件")
    bool IsSelected() const { return bIsSelected; }

    UFUNCTION(BlueprintCallable, Category = "榫卯部件")
    void SetPartPosition(const FVector& NewPosition);

    UFUNCTION(BlueprintCallable, Category = "榫卯部件")
    void SetPartRotation(const FRotator& NewRotation);

    UFUNCTION(BlueprintCallable, Category = "榫卯部件")
    void RotatePart(const FRotator& DeltaRotation);

    UFUNCTION(BlueprintCallable, Category = "榫卯部件")
    bool IsPartPlaced() const { return bIsPlaced; }

    UFUNCTION(BlueprintCallable, Category = "榫卯部件")
    void PlacePart();

    UFUNCTION(BlueprintCallable, Category = "榫卯部件")
    void ResetPart();

    UPROPERTY(BlueprintAssignable, Category = "榫卯事件")
    FOnPartPlaced OnPartPlaced;

    UPROPERTY(BlueprintAssignable, Category = "榫卯事件")
    FOnPartSelected OnPartSelected;

    UPROPERTY(BlueprintAssignable, Category = "榫卯事件")
    FOnPartDeselected OnPartDeselected;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯部件")
    FString PartName;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯部件")
    FString PartDescription;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯部件")
    EPartDifficulty Difficulty;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯部件")
    float Weight;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯部件")
    bool bCanBeMoved;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯部件")
    bool bCanBeRotated;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯部件")
    FVector TargetPosition;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯部件")
    FRotator TargetRotation;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "榫卯部件")
    UStaticMeshComponent* MeshComponent;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "榫卯部件")
    UMT_PhysicsInteractionComponent* PhysicsComponent;

protected:
    virtual void BeginPlay() override;

    virtual void OnConstruction(const FTransform& Transform) override;

private:
    bool bIsSelected;
    bool bIsPlaced;
    FVector InitialPosition;
    FRotator InitialRotation;
};
