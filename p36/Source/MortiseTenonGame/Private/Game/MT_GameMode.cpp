#include "Game/MT_GameMode.h"
#include "Game/MT_LevelData.h"
#include "Kismet/GameplayStatics.h"
#include "TimerManager.h"
#include "Save/MT_SaveManager.h"

AMT_GameMode::AMT_GameMode()
{
    PrimaryActorTick.bCanEverTick = true;
    CurrentLevelID = 1;
    CurrentGameState = EGameState::GS_Menu;
    SelectedPart = nullptr;
    SnappedPartsCount = 0;
    bIsPaused = false;
    bIsLoadingLevel = false;
    CurrentSpawnIndex = 0;
}

void AMT_GameMode::BeginPlay()
{
    Super::BeginPlay();
}

void AMT_GameMode::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);
}

void AMT_GameMode::StartLevel(int32 LevelID)
{
    if (bIsLoadingLevel)
    {
        return;
    }

    bIsLoadingLevel = true;
    CurrentLevelID = LevelID;
    CurrentGameState = EGameState::GS_Playing;
    SnappedPartsCount = 0;
    
    if (SelectedPart)
    {
        SelectedPart->DeselectPart();
        SelectedPart = nullptr;
    }

    GetWorld()->GetTimerManager().ClearTimer(SpawnTimerHandle);
    CleanupPreviousLevel();
}

void AMT_GameMode::CleanupPreviousLevel()
{
    for (int32 i = SpawnedParts.Num() - 1; i >= 0; --i)
    {
        AMT_MortiseTenonPart* Part = SpawnedParts[i];
        if (Part && IsValid(Part))
        {
            if (Part->PhysicsComponent)
            {
                Part->PhysicsComponent->OnJointSnapped.RemoveAll(this);
                Part->PhysicsComponent->ReleaseJoint();
            }
            Part->Destroy();
        }
    }
    SpawnedParts.Empty();
    PendingSpawnData.Empty();
    CurrentSpawnIndex = 0;

    FTimerHandle DummyTimer;
    GetWorld()->GetTimerManager().SetTimer(DummyTimer, this, &AMT_GameMode::SpawnLevelParts, 0.1f, false);
}

void AMT_GameMode::RestartLevel()
{
    StartLevel(CurrentLevelID);
}

void AMT_GameMode::CompleteLevel()
{
    CurrentGameState = EGameState::GS_Completed;
    OnLevelCompleted.Broadcast(CurrentLevelID);
}

void AMT_GameMode::PauseGame()
{
    if (!bIsPaused && CurrentGameState == EGameState::GS_Playing && !bIsLoadingLevel)
    {
        bIsPaused = true;
        CurrentGameState = EGameState::GS_Paused;
        UGameplayStatics::SetGamePaused(GetWorld(), true);
    }
}

void AMT_GameMode::ResumeGame()
{
    if (bIsPaused)
    {
        bIsPaused = false;
        CurrentGameState = EGameState::GS_Playing;
        UGameplayStatics::SetGamePaused(GetWorld(), false);
    }
}

void AMT_GameMode::ReturnToMenu()
{
    GetWorld()->GetTimerManager().ClearTimer(SpawnTimerHandle);
    
    CurrentGameState = EGameState::GS_Menu;
    bIsPaused = false;
    bIsLoadingLevel = false;
    UGameplayStatics::SetGamePaused(GetWorld(), false);
    
    for (int32 i = SpawnedParts.Num() - 1; i >= 0; --i)
    {
        AMT_MortiseTenonPart* Part = SpawnedParts[i];
        if (Part && IsValid(Part))
        {
            if (Part->PhysicsComponent)
            {
                Part->PhysicsComponent->OnJointSnapped.RemoveAll(this);
                Part->PhysicsComponent->ReleaseJoint();
            }
            Part->Destroy();
        }
    }
    SpawnedParts.Empty();
    PendingSpawnData.Empty();
    
    if (SelectedPart)
    {
        SelectedPart = nullptr;
    }
}

void AMT_GameMode::SelectPart(AMT_MortiseTenonPart* Part)
{
    if (bIsLoadingLevel)
    {
        return;
    }

    if (Part && IsValid(Part) && !Part->IsPartPlaced())
    {
        if (SelectedPart && IsValid(SelectedPart))
        {
            SelectedPart->DeselectPart();
        }
        SelectedPart = Part;
        SelectedPart->SelectPart();
    }
}

void AMT_GameMode::DeselectCurrentPart()
{
    if (SelectedPart && IsValid(SelectedPart))
    {
        SelectedPart->DeselectPart();
    }
    SelectedPart = nullptr;
}

void AMT_GameMode::MoveSelectedPart(const FVector& Delta)
{
    if (SelectedPart && IsValid(SelectedPart) && !bIsLoadingLevel)
    {
        FVector NewPosition = SelectedPart->GetActorLocation() + Delta;
        SelectedPart->SetPartPosition(NewPosition);
    }
}

void AMT_GameMode::RotateSelectedPart(const FRotator& Delta)
{
    if (SelectedPart && IsValid(SelectedPart) && !bIsLoadingLevel)
    {
        SelectedPart->RotatePart(Delta);
    }
}

void AMT_GameMode::PlaceSelectedPart()
{
    if (SelectedPart && IsValid(SelectedPart) && !bIsLoadingLevel)
    {
        SelectedPart->PlacePart();
        DeselectCurrentPart();
        
        UMT_SaveManager* SaveManager = UMT_SaveManager::GetInstance();
        if (SaveManager)
        {
            SaveManager->SaveCurrentLevelState(CurrentLevelID, SpawnedParts, 0.0f);
            SaveManager->SaveGame();
        }
        
        CheckLevelCompletion();
    }
}

float AMT_GameMode::GetLevelProgress() const
{
    if (SpawnedParts.Num() == 0)
    {
        return 0.0f;
    }
    
    int32 PlacedCount = 0;
    for (AMT_MortiseTenonPart* Part : SpawnedParts)
    {
        if (Part && IsValid(Part) && Part->IsPartPlaced())
        {
            PlacedCount++;
        }
    }
    
    return static_cast<float>(PlacedCount) / static_cast<float>(SpawnedParts.Num());
}

void AMT_GameMode::ShowHint()
{
}

void AMT_GameMode::HideHint()
{
}

void AMT_GameMode::SpawnLevelParts()
{
    if (!LevelDataClass)
    {
        FinishLevelLoading();
        return;
    }
    
    AMT_LevelData* LevelData = Cast<AMT_LevelData>(LevelDataClass->GetDefaultObject());
    if (!LevelData)
    {
        FinishLevelLoading();
        return;
    }
    
    PendingSpawnData = LevelData->PartSpawnData;
    CurrentSpawnIndex = 0;
    
    if (PendingSpawnData.Num() > 0)
    {
        GetWorld()->GetTimerManager().SetTimer(SpawnTimerHandle, this, &AMT_GameMode::SpawnNextPart, 0.05f, true);
        SpawnNextPart();
    }
    else
    {
        FinishLevelLoading();
    }
}

void AMT_GameMode::SpawnNextPart()
{
    if (CurrentSpawnIndex >= PendingSpawnData.Num())
    {
        GetWorld()->GetTimerManager().ClearTimer(SpawnTimerHandle);
        FinishLevelLoading();
        return;
    }

    const FPartSpawnData& SpawnData = PendingSpawnData[CurrentSpawnIndex];
    
    if (SpawnData.PartClass)
    {
        FActorSpawnParameters SpawnParams;
        SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
        SpawnParams.bNoFail = true;
        
        AMT_MortiseTenonPart* NewPart = GetWorld()->SpawnActor<AMT_MortiseTenonPart>(
            SpawnData.PartClass,
            SpawnData.SpawnLocation,
            SpawnData.SpawnRotation,
            SpawnParams
        );
        
        if (NewPart && IsValid(NewPart))
        {
            NewPart->TargetPosition = SpawnData.TargetLocation;
            NewPart->TargetRotation = SpawnData.TargetRotation;
            SpawnedParts.Add(NewPart);
            
            if (NewPart->PhysicsComponent)
            {
                NewPart->PhysicsComponent->SetCanSnap(false);
                NewPart->PhysicsComponent->OnJointSnapped.AddUObject(this, &AMT_GameMode::OnPartSnappedCallback);
            }
        }
    }
    
    CurrentSpawnIndex++;
}

void AMT_GameMode::FinishLevelLoading()
{
    bIsLoadingLevel = false;
    
    UMT_SaveManager* SaveManager = UMT_SaveManager::GetInstance();
    if (SaveManager)
    {
        TArray<FPartSaveData> SavedParts = SaveManager->LoadLevelState(CurrentLevelID);
        
        if (SavedParts.Num() > 0 && SpawnedParts.Num() > 0)
        {
            UE_LOG(LogTemp, Log, TEXT("恢复关卡 %d 进度: %d 个部件的保存数据"), 
                   CurrentLevelID, SavedParts.Num());
            
            for (int32 i = 0; i < FMath::Min(SavedParts.Num(), SpawnedParts.Num()); ++i)
            {
                AMT_MortiseTenonPart* Part = SpawnedParts[i];
                const FPartSaveData& PartData = SavedParts[i];
                
                if (Part && IsValid(Part))
                {
                    Part->SetActorLocationAndRotation(PartData.WorldLocation, PartData.WorldRotation);
                    
                    if (PartData.bIsPlaced)
                    {
                        Part->PlacePart();
                    }
                }
            }
        }
    }
    
    for (AMT_MortiseTenonPart* Part : SpawnedParts)
    {
        if (Part && IsValid(Part) && Part->PhysicsComponent)
        {
            Part->PhysicsComponent->SetCanSnap(true);
        }
    }
}

void AMT_GameMode::CheckLevelCompletion()
{
    if (bIsLoadingLevel)
    {
        return;
    }

    bool bAllPlaced = true;
    for (AMT_MortiseTenonPart* Part : SpawnedParts)
    {
        if (Part && IsValid(Part) && !Part->IsPartPlaced())
        {
            bAllPlaced = false;
            break;
        }
    }
    
    if (bAllPlaced && SpawnedParts.Num() > 0)
    {
        OnAllPartsPlaced.Broadcast();
        CompleteLevel();
    }
}

void AMT_GameMode::OnPartSnappedCallback(UMT_PhysicsInteractionComponent* SnappedComponent)
{
    if (SnappedComponent && IsValid(SnappedComponent))
    {
        AMT_MortiseTenonPart* Part = Cast<AMT_MortiseTenonPart>(SnappedComponent->GetOwner());
        if (Part && IsValid(Part))
        {
            SnappedPartsCount++;
            OnPartSnapped.Broadcast(Part);
        }
    }
}
