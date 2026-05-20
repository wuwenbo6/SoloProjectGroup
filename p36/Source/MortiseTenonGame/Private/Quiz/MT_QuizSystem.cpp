#include "Quiz/MT_QuizSystem.h"

UMT_QuizSystem::UMT_QuizSystem()
{
    bIsQuizActive = false;
}

void UMT_QuizSystem::InitializeQuizSystem()
{
    LoadDefaultQuestions();
}

bool UMT_QuizSystem::StartQuiz(int32 LevelID, EQuizDifficulty Difficulty, int32 QuestionCount)
{
    TArray<FQuizQuestion> QuestionPool = GetQuestionsByDifficulty(Difficulty);

    if (QuestionPool.Num() < QuestionCount)
    {
        QuestionCount = QuestionPool.Num();
    }

    if (QuestionCount == 0)
    {
        return false;
    }

    CurrentSession.Questions = SelectRandomQuestions(QuestionPool, QuestionCount);
    CurrentSession.CurrentQuestionIndex = 0;
    CurrentSession.TotalScore = 0;
    CurrentSession.CorrectAnswers = 0;
    CurrentSession.QuestionsAttempted = 0;
    CurrentSession.TimeElapsed = 0.0f;

    bIsQuizActive = true;
    return true;
}

FQuizQuestion UMT_QuizSystem::GetCurrentQuestion() const
{
    if (bIsQuizActive && CurrentSession.CurrentQuestionIndex < CurrentSession.Questions.Num())
    {
        return CurrentSession.Questions[CurrentSession.CurrentQuestionIndex];
    }
    return FQuizQuestion();
}

bool UMT_QuizSystem::AnswerQuestion(int32 SelectedOptionIndex)
{
    if (!bIsQuizActive || CurrentSession.CurrentQuestionIndex >= CurrentSession.Questions.Num())
    {
        return false;
    }

    const FQuizQuestion& Question = CurrentSession.Questions[CurrentSession.CurrentQuestionIndex];
    bool bIsCorrect = (SelectedOptionIndex == Question.CorrectAnswerIndex);

    CurrentSession.QuestionsAttempted++;

    if (bIsCorrect)
    {
        CurrentSession.TotalScore += Question.Points;
        CurrentSession.CorrectAnswers++;
    }

    OnQuestionAnswered.Broadcast(bIsCorrect);

    return bIsCorrect;
}

bool UMT_QuizSystem::NextQuestion()
{
    if (!bIsQuizActive)
    {
        return false;
    }

    CurrentSession.CurrentQuestionIndex++;

    if (IsQuizComplete())
    {
        OnQuizCompleted.Broadcast(CurrentSession);
        bIsQuizActive = false;
        return false;
    }

    return true;
}

void UMT_QuizSystem::SkipQuestion()
{
    if (bIsQuizActive)
    {
        CurrentSession.QuestionsAttempted++;
        NextQuestion();
    }
}

bool UMT_QuizSystem::IsQuizComplete() const
{
    return bIsQuizActive && CurrentSession.CurrentQuestionIndex >= CurrentSession.Questions.Num();
}

float UMT_QuizSystem::GetProgress() const
{
    if (CurrentSession.Questions.Num() == 0)
    {
        return 0.0f;
    }
    return static_cast<float>(CurrentSession.CurrentQuestionIndex) / CurrentSession.Questions.Num();
}

TArray<FString> UMT_QuizSystem::GetHintForCurrentQuestion()
{
    TArray<FString> Hints;

    if (!bIsQuizActive || CurrentSession.CurrentQuestionIndex >= CurrentSession.Questions.Num())
    {
        return Hints;
    }

    const FQuizQuestion& Question = CurrentSession.Questions[CurrentSession.CurrentQuestionIndex];

    Hints.Add(TEXT("知识点分类：") + Question.KnowledgeCategory);

    switch (Question.Difficulty)
    {
        case EQuizDifficulty::QD_Easy:
            Hints.Add(TEXT("提示：正确答案通常是最基础的那个选项"));
            break;
        case EQuizDifficulty::QD_Medium:
            Hints.Add(TEXT("提示：仔细阅读每个选项，排除明显错误的"));
            break;
        case EQuizDifficulty::QD_Hard:
            Hints.Add(TEXT("提示：这道题需要你对榫卯有较深入的理解"));
            break;
    }

    return Hints;
}

void UMT_QuizSystem::AddQuestion(const FQuizQuestion& NewQuestion)
{
    QuestionDatabase.Add(NewQuestion);
}

TArray<FQuizQuestion> UMT_QuizSystem::GetQuestionsByDifficulty(EQuizDifficulty Difficulty) const
{
    TArray<FQuizQuestion> Result;
    for (const FQuizQuestion& Question : QuestionDatabase)
    {
        if (Question.Difficulty == Difficulty)
        {
            Result.Add(Question);
        }
    }
    return Result;
}

TArray<FQuizQuestion> UMT_QuizSystem::GetQuestionsByCategory(const FString& Category) const
{
    TArray<FQuizQuestion> Result;
    for (const FQuizQuestion& Question : QuestionDatabase)
    {
        if (Question.KnowledgeCategory == Category)
        {
            Result.Add(Question);
        }
    }
    return Result;
}

void UMT_QuizSystem::LoadDefaultQuestions()
{
    FQuizQuestion Q1;
    Q1.QuestionText = TEXT("榫卯结构起源于哪个国家？");
    Q1.Options = {TEXT("中国"), TEXT("日本"), TEXT("韩国"), TEXT("印度")};
    Q1.CorrectAnswerIndex = 0;
    Q1.Explanation = TEXT("榫卯是中国古代建筑、家具及其他器械的主要结构方式，距今已有7000多年的历史。");
    Q1.Difficulty = EQuizDifficulty::QD_Easy;
    Q1.KnowledgeCategory = TEXT("历史文化");
    Q1.Points = 10;
    AddQuestion(Q1);

    FQuizQuestion Q2;
    Q2.QuestionText = TEXT("\"榫\"和\"卯\"分别指什么？");
    Q2.Options = {TEXT("都是凸的部分"), TEXT("都是凹的部分"), TEXT("凸的部分和凹的部分"), TEXT("凹的部分和凸的部分")};
    Q2.CorrectAnswerIndex = 2;
    Q2.Explanation = TEXT("\"榫\"是突出的部分，\"卯\"是凹进的部分，两者相互咬合实现连接。");
    Q2.Difficulty = EQuizDifficulty::QD_Easy;
    Q2.KnowledgeCategory = TEXT("基础概念");
    Q2.Points = 10;
    AddQuestion(Q2);

    FQuizQuestion Q3;
    Q3.QuestionText = TEXT("榫卯结构最大的特点是什么？");
    Q3.Options = {TEXT("使用钉子固定"), TEXT("使用胶水粘合"), TEXT("不使用钉子，靠结构本身咬合"), TEXT("只能用于小型家具")};
    Q3.CorrectAnswerIndex = 2;
    Q3.Explanation = TEXT("榫卯的精髓在于不需要钉子或胶水，仅靠木构件本身的凹凸咬合就能实现牢固连接。");
    Q3.Difficulty = EQuizDifficulty::QD_Easy;
    Q3.KnowledgeCategory = TEXT("结构特点");
    Q3.Points = 10;
    AddQuestion(Q3);

    FQuizQuestion Q4;
    Q4.QuestionText = TEXT("以下哪种是最基础的榫卯结构？");
    Q4.Options = {TEXT("燕尾榫"), TEXT("格角榫"), TEXT("平肩榫"), TEXT("粽角榫")};
    Q4.CorrectAnswerIndex = 2;
    Q4.Explanation = TEXT("平肩榫是最基础的榫卯结构之一，常用于方材与方材的直角连接。");
    Q4.Difficulty = EQuizDifficulty::QD_Medium;
    Q4.KnowledgeCategory = TEXT("结构类型");
    Q4.Points = 20;
    AddQuestion(Q4);

    FQuizQuestion Q5;
    Q5.QuestionText = TEXT("燕尾榫主要用于什么部位？");
    Q5.Options = {TEXT("抽屉侧板与面板连接"), TEXT("桌腿与桌面连接"), TEXT("椅子靠背"), TEXT("门框连接")};
    Q5.CorrectAnswerIndex = 0;
    Q5.Explanation = TEXT("燕尾榫因其形状像燕子尾巴而得名，主要用于抽屉等需要强拉力的部位。");
    Q5.Difficulty = EQuizDifficulty::QD_Medium;
    Q5.KnowledgeCategory = TEXT("应用场景");
    Q5.Points = 20;
    AddQuestion(Q5);

    FQuizQuestion Q6;
    Q6.QuestionText = TEXT("传统木结构建筑中，\"斗拱\"是一种什么结构？");
    Q6.Options = {TEXT("简单的榫卯结构"), TEXT("复杂的承重和装饰结构"), TEXT("纯装饰结构"), TEXT("现代建筑结构")};
    Q6.CorrectAnswerIndex = 1;
    Q6.Explanation = TEXT("斗拱是中国古代建筑特有的结构，兼具承重和装饰功能，由多个复杂的榫卯组合而成。");
    Q6.Difficulty = EQuizDifficulty::QD_Medium;
    Q6.KnowledgeCategory = TEXT("高级结构");
    Q6.Points = 20;
    AddQuestion(Q6);

    FQuizQuestion Q7;
    Q7.QuestionText = TEXT("\"万榫之母\"指的是哪种榫卯？");
    Q7.Options = {TEXT("燕尾榫"), TEXT("霸王枨"), TEXT("粽角榫"), TEXT("格肩榫")};
    Q7.CorrectAnswerIndex = 2;
    Q7.Explanation = TEXT("粽角榫因其结构复杂，三个面都能看到榫头，被称为\"万榫之母\"。");
    Q7.Difficulty = EQuizDifficulty::QD_Hard;
    Q7.KnowledgeCategory = TEXT("高级结构");
    Q7.Points = 30;
    AddQuestion(Q7);

    FQuizQuestion Q8;
    Q8.QuestionText = TEXT("明式家具中，\"霸王枨\"的主要作用是什么？");
    Q8.Options = {TEXT("纯粹装饰"), TEXT("加固桌面，防止摇晃"), TEXT("连接抽屉"), TEXT("增加高度")};
    Q8.CorrectAnswerIndex = 1;
    Q8.Explanation = TEXT("霸王枨是连接桌面与腿足的斜向构件，既能加固结构，又不影响美观，是明式家具的经典设计。");
    Q8.Difficulty = EQuizDifficulty::QD_Hard;
    Q8.KnowledgeCategory = TEXT("明式家具");
    Q8.Points = 30;
    AddQuestion(Q8);

    FQuizQuestion Q9;
    Q9.QuestionText = TEXT("榫卯结构相比现代五金连接，最大的优势是什么？");
    Q9.Options = {TEXT("制作更快"), TEXT("成本更低"), TEXT("寿命更长，更环保"), TEXT("更容易拆卸")};
    Q9.CorrectAnswerIndex = 2;
    Q9.Explanation = TEXT("榫卯结构依靠木材本身，不会像五金那样生锈老化，且完全环保，许多古建历经千年仍完好。");
    Q9.Difficulty = EQuizDifficulty::QD_Hard;
    Q9.KnowledgeCategory = TEXT("结构优势");
    Q9.Points = 30;
    AddQuestion(Q9);

    FQuizQuestion Q10;
    Q10.QuestionText = TEXT("山西应县木塔使用了多少种榫卯结构？");
    Q10.Options = {TEXT("10多种"), TEXT("30多种"), TEXT("50多种"), TEXT("100多种")};
    Q10.CorrectAnswerIndex = 2;
    Q10.Explanation = TEXT("应县木塔使用了50多种榫卯结构，历经多次大地震而不倒，是中国古代木结构建筑的巅峰之作。");
    Q10.Difficulty = EQuizDifficulty::QD_Hard;
    Q10.KnowledgeCategory = TEXT("历史建筑");
    Q10.Points = 30;
    AddQuestion(Q10);
}

TArray<FQuizQuestion> UMT_QuizSystem::SelectRandomQuestions(const TArray<FQuizQuestion>& Pool, int32 Count) const
{
    TArray<FQuizQuestion> Result;
    TArray<int32> Indices;

    for (int32 i = 0; i < Pool.Num(); i++)
    {
        Indices.Add(i);
    }

    for (int32 i = 0; i < Count && Indices.Num() > 0; i++)
    {
        int32 RandomIndex = FMath::RandRange(0, Indices.Num() - 1);
        Result.Add(Pool[Indices[RandomIndex]]);
        Indices.RemoveAt(RandomIndex);
    }

    return Result;
}
