#pragma once

#include "CoreMinimal.h"
#include "MT_EducationManager.generated.h"

UENUM(BlueprintType)
enum class EKnowledgeCategory : uint8
{
    KC_History UMETA(DisplayName = "历史发展"),
    KC_JointType UMETA(DisplayName = "榫卯类型"),
    KC_Architecture UMETA(DisplayName = "古建筑应用"),
    KC_Culture UMETA(DisplayName = "文化意义"),
    KC_Craftsmanship UMETA(DisplayName = "工艺技术")
};

USTRUCT(BlueprintType)
struct FJointKnowledgeData
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "榫卯教育")
    FString JointName;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "榫卯教育")
    FString ChineseName;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "榫卯教育")
    EKnowledgeCategory Category;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "榫卯教育")
    FString Description;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "榫卯教育")
    FString HistoricalContext;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "榫卯教育")
    FString ApplicationExamples;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "榫卯教育")
    int32 DifficultyLevel;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "榫卯教育")
    bool bIsUnlocked;
};

USTRUCT(BlueprintType)
struct FEducationContent
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "榫卯教育")
    FString Title;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "榫卯教育")
    EKnowledgeCategory Category;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "榫卯教育")
    FString Content;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "榫卯教育")
    FString ImageReference;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "榫卯教育")
    TArray<FString> KeyPoints;
};

UCLASS(Blueprintable, BlueprintType)
class MORTISETENONGAME_API UMT_EducationManager : public UObject
{
    GENERATED_BODY()

public:
    UMT_EducationManager();

    UFUNCTION(BlueprintCallable, Category = "榫卯教育")
    static UMT_EducationManager* GetInstance();

    UFUNCTION(BlueprintCallable, Category = "榫卯教育")
    void InitializeKnowledgeBase();

    UFUNCTION(BlueprintCallable, Category = "榫卯教育")
    TArray<FJointKnowledgeData> GetAllJointKnowledge() const;

    UFUNCTION(BlueprintCallable, Category = "榫卯教育")
    TArray<FJointKnowledgeData> GetJointKnowledgeByCategory(EKnowledgeCategory Category) const;

    UFUNCTION(BlueprintCallable, Category = "榫卯教育")
    FJointKnowledgeData GetJointKnowledgeByName(const FString& JointName) const;

    UFUNCTION(BlueprintCallable, Category = "榫卯教育")
    void UnlockJointKnowledge(const FString& JointName);

    UFUNCTION(BlueprintCallable, Category = "榫卯教育")
    void UnlockKnowledgeByLevel(int32 LevelID);

    UFUNCTION(BlueprintCallable, Category = "榫卯教育")
    TArray<FEducationContent> GetEducationContentByCategory(EKnowledgeCategory Category) const;

    UFUNCTION(BlueprintCallable, Category = "榫卯教育")
    FEducationContent GetEducationContent(const FString& Title) const;

    UFUNCTION(BlueprintCallable, Category = "榫卯教育")
    int32 GetTotalKnowledgeCount() const { return JointKnowledgeDatabase.Num(); }

    UFUNCTION(BlueprintCallable, Category = "榫卯教育")
    int32 GetUnlockedKnowledgeCount() const;

    UFUNCTION(BlueprintCallable, Category = "榫卯教育")
    float GetKnowledgeProgress() const;

private:
    void InitializeJointDatabase();
    void InitializeEducationContent();
    
    UPROPERTY()
    TArray<FJointKnowledgeData> JointKnowledgeDatabase;

    UPROPERTY()
    TArray<FEducationContent> EducationContentDatabase;

    static UMT_EducationManager* Instance;
};
