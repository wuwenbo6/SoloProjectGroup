#pragma once

#include "CoreMinimal.h"
#include "MT_PartLibrary.generated.h"

UENUM(BlueprintType)
enum class EPartCategory : uint8
{
    PC_Basic UMETA(DisplayName = "基础部件"),
    PC_Connector UMETA(DisplayName = "连接部件"),
    PC_Decorative UMETA(DisplayName = "装饰部件"),
    PC_Structural UMETA(DisplayName = "结构部件"),
    PC_Advanced UMETA(DisplayName = "高级部件"),
    PC_Custom UMETA(DisplayName = "自定义部件")
};

USTRUCT(BlueprintType)
struct FPartDefinition
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯部件")
    FString PartID;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯部件")
    FString PartName;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯部件")
    FString Description;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯部件")
    EPartCategory Category;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯部件")
    TSubclassOf<AActor> PartActorClass;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯部件")
    UTexture2D* Thumbnail;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯部件")
    float UnlockScore;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯部件")
    int32 MaxCountInBuild;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯部件")
    TArray<FString> CompatibleParts;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯部件")
    bool bIsUnlockedByDefault;
};

USTRUCT(BlueprintType)
struct FPlacedPartData
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadWrite, Category = "榫卯搭建")
    FString PartID;

    UPROPERTY(BlueprintReadWrite, Category = "榫卯搭建")
    FTransform WorldTransform;

    UPROPERTY(BlueprintReadWrite, Category = "榫卯搭建")
    TArray<FString> ConnectedPartIDs;

    UPROPERTY(BlueprintReadWrite, Category = "榫卯搭建")
    int32 UniqueInstanceID;

    UPROPERTY(BlueprintReadWrite, Category = "榫卯搭建")
    FString PlacedByPlayerID;

    UPROPERTY(BlueprintReadWrite, Category = "榫卯搭建")
    FDateTime PlacementTime;
};

USTRUCT(BlueprintType)
struct FCustomBuildData
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadWrite, Category = "榫卯搭建")
    FString BuildID;

    UPROPERTY(BlueprintReadWrite, Category = "榫卯搭建")
    FString BuildName;

    UPROPERTY(BlueprintReadWrite, Category = "榫卯搭建")
    FString CreatorPlayerID;

    UPROPERTY(BlueprintReadWrite, Category = "榫卯搭建")
    FString CreatorName;

    UPROPERTY(BlueprintReadWrite, Category = "榫卯搭建")
    TArray<FPlacedPartData> PlacedParts;

    UPROPERTY(BlueprintReadWrite, Category = "榫卯搭建")
    FDateTime CreationTime;

    UPROPERTY(BlueprintReadWrite, Category = "榫卯搭建")
    FDateTime LastModifiedTime;

    UPROPERTY(BlueprintReadWrite, Category = "榫卯搭建")
    int32 LikeCount;

    UPROPERTY(BlueprintReadWrite, Category = "榫卯搭建")
    int32 ViewCount;

    UPROPERTY(BlueprintReadWrite, Category = "榫卯搭建")
    bool bIsPublic;

    UPROPERTY(BlueprintReadWrite, Category = "榫卯搭建")
    FString ThumbnailPath;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnPartPlaced, const FPlacedPartData&, PlacedPart);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnPartRemoved, const FPlacedPartData&, RemovedPart);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnBuildSaved, const FCustomBuildData&, SavedBuild);

UCLASS(Blueprintable, BlueprintType)
class MORTISETENONGAME_API UMT_PartLibrary : public UObject
{
    GENERATED_BODY()

public:
    UMT_PartLibrary();

    UFUNCTION(BlueprintCallable, Category = "榫卯部件库")
    void InitializeLibrary();

    UFUNCTION(BlueprintCallable, Category = "榫卯部件库")
    TArray<FPartDefinition> GetAllParts() const { return PartDefinitions; }

    UFUNCTION(BlueprintCallable, Category = "榫卯部件库")
    TArray<FPartDefinition> GetPartsByCategory(EPartCategory Category) const;

    UFUNCTION(BlueprintCallable, Category = "榫卯部件库")
    FPartDefinition GetPartByID(const FString& PartID) const;

    UFUNCTION(BlueprintCallable, Category = "榫卯部件库")
    void AddCustomPart(const FPartDefinition& NewPart);

    UFUNCTION(BlueprintCallable, Category = "榫卯部件库")
    bool UnlockPart(const FString& PartID, float PlayerScore);

    UFUNCTION(BlueprintCallable, Category = "榫卯部件库")
    bool IsPartUnlocked(const FString& PartID) const;

    UPROPERTY(BlueprintAssignable, Category = "榫卯部件库事件")
    FOnPartPlaced OnPartPlaced;

    UPROPERTY(BlueprintAssignable, Category = "榫卯部件库事件")
    FOnPartRemoved OnPartRemoved;

    UPROPERTY(BlueprintAssignable, Category = "榫卯部件库事件")
    FOnBuildSaved OnBuildSaved;

private:
    UPROPERTY()
    TArray<FPartDefinition> PartDefinitions;

    UPROPERTY()
    TArray<FString> UnlockedPartIDs;

    void LoadDefaultParts();
};
