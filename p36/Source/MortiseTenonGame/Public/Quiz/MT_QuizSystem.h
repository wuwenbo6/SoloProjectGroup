#pragma once

#include "CoreMinimal.h"
#include "MT_QuizSystem.generated.h"

UENUM(BlueprintType)
enum class EQuizDifficulty : uint8
{
    QD_Easy UMETA(DisplayName = "简单"),
    QD_Medium UMETA(DisplayName = "中等"),
    QD_Hard UMETA(DisplayName = "困难")
};

USTRUCT(BlueprintType)
struct FQuizQuestion
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "榫卯问答")
    FString QuestionText;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "榫卯问答")
    TArray<FString> Options;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "榫卯问答")
    int32 CorrectAnswerIndex;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "榫卯问答")
    FString Explanation;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "榫卯问答")
    EQuizDifficulty Difficulty;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "榫卯问答")
    FString KnowledgeCategory;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "榫卯问答")
    int32 Points;
};

USTRUCT(BlueprintType)
struct FQuizSession
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "榫卯问答")
    TArray<FQuizQuestion> Questions;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯问答")
    int32 CurrentQuestionIndex;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯问答")
    int32 TotalScore;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯问答")
    int32 CorrectAnswers;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯问答")
    int32 QuestionsAttempted;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯问答")
    float TimeElapsed;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnQuestionAnswered, bool, bIsCorrect);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnQuizCompleted, const FQuizSession&, FinalResults);

UCLASS(Blueprintable, BlueprintType)
class MORTISETENONGAME_API UMT_QuizSystem : public UObject
{
    GENERATED_BODY()

public:
    UMT_QuizSystem();

    UFUNCTION(BlueprintCallable, Category = "榫卯问答")
    void InitializeQuizSystem();

    UFUNCTION(BlueprintCallable, Category = "榫卯问答")
    bool StartQuiz(int32 LevelID, EQuizDifficulty Difficulty, int32 QuestionCount = 5);

    UFUNCTION(BlueprintCallable, Category = "榫卯问答")
    FQuizQuestion GetCurrentQuestion() const;

    UFUNCTION(BlueprintCallable, Category = "榫卯问答")
    bool AnswerQuestion(int32 SelectedOptionIndex);

    UFUNCTION(BlueprintCallable, Category = "榫卯问答")
    bool NextQuestion();

    UFUNCTION(BlueprintCallable, Category = "榫卯问答")
    void SkipQuestion();

    UFUNCTION(BlueprintCallable, Category = "榫卯问答")
    bool IsQuizComplete() const;

    UFUNCTION(BlueprintCallable, Category = "榫卯问答")
    FQuizSession GetCurrentSession() const { return CurrentSession; }

    UFUNCTION(BlueprintCallable, Category = "榫卯问答")
    float GetProgress() const;

    UFUNCTION(BlueprintCallable, Category = "榫卯问答")
    TArray<FString> GetHintForCurrentQuestion();

    UPROPERTY(BlueprintAssignable, Category = "榫卯问答事件")
    FOnQuestionAnswered OnQuestionAnswered;

    UPROPERTY(BlueprintAssignable, Category = "榫卯问答事件")
    FOnQuizCompleted OnQuizCompleted;

    UPROPERTY(EditAnywhere, Category = "榫卯问答")
    TArray<FQuizQuestion> QuestionDatabase;

    UFUNCTION(BlueprintCallable, Category = "榫卯问答")
    void AddQuestion(const FQuizQuestion& NewQuestion);

    UFUNCTION(BlueprintCallable, Category = "榫卯问答")
    TArray<FQuizQuestion> GetQuestionsByDifficulty(EQuizDifficulty Difficulty) const;

    UFUNCTION(BlueprintCallable, Category = "榫卯问答")
    TArray<FQuizQuestion> GetQuestionsByCategory(const FString& Category) const;

private:
    void LoadDefaultQuestions();
    TArray<FQuizQuestion> SelectRandomQuestions(const TArray<FQuizQuestion>& Pool, int32 Count) const;

    FQuizSession CurrentSession;
    bool bIsQuizActive;
};
