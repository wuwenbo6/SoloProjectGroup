#pragma once

#include "CoreMinimal.h"
#include "MT_PartLibrary.h"
#include "MT_FreeBuildManager.generated.h"

UENUM(BlueprintType)
enum class EBuildToolMode : uint8
{
    BT_Select UMETA(DisplayName = "选择工具"),
    BT_Place UMETA(DisplayName = "放置工具"),
    BT_Rotate UMETA(DisplayName = "旋转工具"),
    BT_Move UMETA(DisplayName = "移动工具"),
    BT_Delete UMETA(DisplayName = "删除工具"),
    BT_Connect UMETA(DisplayName = "连接工具")
};

UENUM(BlueprintType)
enum class EGridSnapMode : uint8
{
    GSM_Off UMETA(DisplayName = "无吸附"),
    GSM_Grid UMETA(DisplayName = "网格吸附"),
    GSM_Part UMETA(DisplayName = "部件吸附"),
    GSM_Both UMETA(DisplayName = "双重吸附")
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnToolModeChanged, EBuildToolMode, NewMode);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnSelectionChanged, AActor*, NewSelection, AActor*, OldSelection);

UCLASS(Blueprintable, BlueprintType)
class MORTISETENONGAME_API UMT_FreeBuildManager : public UObject
{
    GENERATED_BODY()

public:
    UMT_FreeBuildManager();

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    void InitializeBuildManager(UMT_PartLibrary* InPartLibrary);

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    void SetToolMode(EBuildToolMode NewMode);

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    EBuildToolMode GetCurrentToolMode() const { return CurrentToolMode; }

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    void SelectPartFromLibrary(const FString& PartID);

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    void PlaceSelectedPartAtLocation(const FTransform& PlacementTransform);

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    void SelectActor(AActor* ActorToSelect);

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    void DeleteSelectedPart();

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    void RotateSelectedPart(const FRotator& DeltaRotation);

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    void MoveSelectedPart(const FVector& DeltaLocation);

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    void DuplicateSelectedPart();

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    void SetGridSnapMode(EGridSnapMode NewMode);

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    void SetGridSize(float NewSize);

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    FVector SnapToGrid(const FVector& Location) const;

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    bool SaveCurrentBuild(const FString& BuildName, bool bMakePublic = false);

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    bool LoadBuild(const FString& BuildID);

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    TArray<FCustomBuildData> GetSavedBuilds() const;

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    void ClearAllParts();

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    int32 GetPlacedPartCount() const { return PlacedParts.Num(); }

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    TArray<AActor*> GetAllPlacedActors() const;

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    void UndoLastAction();

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    void RedoLastAction();

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    bool CanUndo() const { return UndoStack.Num() > 0; }

    UFUNCTION(BlueprintCallable, Category = "自由搭建")
    bool CanRedo() const { return RedoStack.Num() > 0; }

    UPROPERTY(BlueprintAssignable, Category = "自由搭建事件")
    FOnToolModeChanged OnToolModeChanged;

    UPROPERTY(BlueprintAssignable, Category = "自由搭建事件")
    FOnSelectionChanged OnSelectionChanged;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "自由搭建设置")
    float GridSize;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "自由搭建设置")
    EGridSnapMode CurrentSnapMode;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "自由搭建设置")
    int32 MaxUndoSteps;

    UPROPERTY(BlueprintReadOnly, Category = "自由搭建")
    FString SelectedPartID;

    UPROPERTY(BlueprintReadOnly, Category = "自由搭建")
    AActor* SelectedActor;

private:
    struct FBuildAction
    {
        enum ActionType
        {
            Place,
            Delete,
            Move,
            Rotate,
            Duplicate
        };

        ActionType Type;
        FPlacedPartData PartData;
        FTransform OldTransform;
        FTransform NewTransform;
    };

    UPROPERTY()
    UMT_PartLibrary* PartLibrary;

    UPROPERTY()
    TArray<AActor*> PlacedParts;

    UPROPERTY()
    TMap<int32, AActor*> InstanceIDToActor;

    TArray<FBuildAction> UndoStack;
    TArray<FBuildAction> RedoStack;

    EBuildToolMode CurrentToolMode;

    int32 NextInstanceID;

    FTransform SnapToPart(const FTransform& InTransform) const;
    void PushUndoAction(const FBuildAction& Action);
    void ClearRedoStack();
};
