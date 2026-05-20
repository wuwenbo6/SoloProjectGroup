#include "Game/MT_PlayerController.h"
#include "Game/MT_GameMode.h"
#include "MortiseTenon/MT_MortiseTenonPart.h"
#include "Kismet/GameplayStatics.h"

AMT_PlayerController::AMT_PlayerController()
{
    bGameInputEnabled = true;
    bShowMouseCursor = true;
    bEnableClickEvents = true;
    bEnableMouseOverEvents = true;
}

void AMT_PlayerController::BeginPlay()
{
    Super::BeginPlay();
}

void AMT_PlayerController::SetupInputComponent()
{
    Super::SetupInputComponent();

    if (InputComponent)
    {
        InputComponent->BindAction("LeftClick", IE_Pressed, this, &AMT_PlayerController::OnMouseLeftClick);
        InputComponent->BindAction("LeftClick", IE_Released, this, &AMT_PlayerController::OnMouseLeftRelease);
        InputComponent->BindAction("RightClick", IE_Pressed, this, &AMT_PlayerController::OnMouseRightClick);
        InputComponent->BindAction("MouseWheelUp", IE_Pressed, this, &AMT_PlayerController::OnMouseWheelUp);
        InputComponent->BindAction("MouseWheelDown", IE_Pressed, this, &AMT_PlayerController::OnMouseWheelDown);
        InputComponent->BindAction("Pause", IE_Pressed, this, &AMT_PlayerController::OnPausePressed);
        InputComponent->BindAction("Hint", IE_Pressed, this, &AMT_PlayerController::OnHintPressed);
        InputComponent->BindAction("RotateX", IE_Pressed, this, &AMT_PlayerController::OnRotatePartX);
        InputComponent->BindAction("RotateY", IE_Pressed, this, &AMT_PlayerController::OnRotatePartY);
        InputComponent->BindAction("RotateZ", IE_Pressed, this, &AMT_PlayerController::OnRotatePartZ);
        InputComponent->BindAction("PlacePart", IE_Pressed, this, &AMT_PlayerController::OnPlacePart);

        InputComponent->BindAxis("MoveForward", this, &AMT_PlayerController::MoveForward);
        InputComponent->BindAxis("MoveRight", this, &AMT_PlayerController::MoveRight);
        InputComponent->BindAxis("MoveUp", this, &AMT_PlayerController::MoveUp);
        InputComponent->BindAxis("RotateYaw", this, &AMT_PlayerController::RotateYaw);
        InputComponent->BindAxis("RotatePitch", this, &AMT_PlayerController::RotatePitch);
    }
}

void AMT_PlayerController::EnableGameInput()
{
    bGameInputEnabled = true;
}

void AMT_PlayerController::DisableGameInput()
{
    bGameInputEnabled = false;
}

void AMT_PlayerController::OnMouseLeftClick()
{
    if (!bGameInputEnabled) return;

    FHitResult HitResult;
    if (GetHitResultUnderCursor(ECC_Visibility, false, HitResult))
    {
        AMT_MortiseTenonPart* HitPart = Cast<AMT_MortiseTenonPart>(HitResult.GetActor());
        if (HitPart)
        {
            AMT_GameMode* GameMode = Cast<AMT_GameMode>(UGameplayStatics::GetGameMode(GetWorld()));
            if (GameMode)
            {
                GameMode->SelectPart(HitPart);
            }
        }
    }
}

void AMT_PlayerController::OnMouseLeftRelease()
{
}

void AMT_PlayerController::OnMouseRightClick()
{
    if (!bGameInputEnabled) return;

    AMT_GameMode* GameMode = Cast<AMT_GameMode>(UGameplayStatics::GetGameMode(GetWorld()));
    if (GameMode)
    {
        GameMode->DeselectCurrentPart();
    }
}

void AMT_PlayerController::OnMouseWheelUp()
{
    if (!bGameInputEnabled) return;
}

void AMT_PlayerController::OnMouseWheelDown()
{
    if (!bGameInputEnabled) return;
}

void AMT_PlayerController::MoveForward(float Value)
{
    if (!bGameInputEnabled || Value == 0.0f) return;

    AMT_GameMode* GameMode = Cast<AMT_GameMode>(UGameplayStatics::GetGameMode(GetWorld()));
    if (GameMode && GameMode->GetSelectedPart())
    {
        FVector MoveVector = FVector(Value * 5.0f, 0.0f, 0.0f);
        GameMode->MoveSelectedPart(MoveVector);
    }
}

void AMT_PlayerController::MoveRight(float Value)
{
    if (!bGameInputEnabled || Value == 0.0f) return;

    AMT_GameMode* GameMode = Cast<AMT_GameMode>(UGameplayStatics::GetGameMode(GetWorld()));
    if (GameMode && GameMode->GetSelectedPart())
    {
        FVector MoveVector = FVector(0.0f, Value * 5.0f, 0.0f);
        GameMode->MoveSelectedPart(MoveVector);
    }
}

void AMT_PlayerController::MoveUp(float Value)
{
    if (!bGameInputEnabled || Value == 0.0f) return;

    AMT_GameMode* GameMode = Cast<AMT_GameMode>(UGameplayStatics::GetGameMode(GetWorld()));
    if (GameMode && GameMode->GetSelectedPart())
    {
        FVector MoveVector = FVector(0.0f, 0.0f, Value * 5.0f);
        GameMode->MoveSelectedPart(MoveVector);
    }
}

void AMT_PlayerController::RotateYaw(float Value)
{
    if (!bGameInputEnabled) return;
}

void AMT_PlayerController::RotatePitch(float Value)
{
    if (!bGameInputEnabled) return;
}

void AMT_PlayerController::OnPausePressed()
{
    AMT_GameMode* GameMode = Cast<AMT_GameMode>(UGameplayStatics::GetGameMode(GetWorld()));
    if (GameMode)
    {
        if (GameMode->GetCurrentGameState() == EGameState::GS_Playing)
        {
            GameMode->PauseGame();
        }
        else if (GameMode->GetCurrentGameState() == EGameState::GS_Paused)
        {
            GameMode->ResumeGame();
        }
    }
}

void AMT_PlayerController::OnHintPressed()
{
    if (!bGameInputEnabled) return;

    AMT_GameMode* GameMode = Cast<AMT_GameMode>(UGameplayStatics::GetGameMode(GetWorld()));
    if (GameMode)
    {
        GameMode->ShowHint();
    }
}

void AMT_PlayerController::OnRotatePartX()
{
    if (!bGameInputEnabled) return;

    AMT_GameMode* GameMode = Cast<AMT_GameMode>(UGameplayStatics::GetGameMode(GetWorld()));
    if (GameMode && GameMode->GetSelectedPart())
    {
        FRotator Rotation = FRotator(15.0f, 0.0f, 0.0f);
        GameMode->RotateSelectedPart(Rotation);
    }
}

void AMT_PlayerController::OnRotatePartY()
{
    if (!bGameInputEnabled) return;

    AMT_GameMode* GameMode = Cast<AMT_GameMode>(UGameplayStatics::GetGameMode(GetWorld()));
    if (GameMode && GameMode->GetSelectedPart())
    {
        FRotator Rotation = FRotator(0.0f, 15.0f, 0.0f);
        GameMode->RotateSelectedPart(Rotation);
    }
}

void AMT_PlayerController::OnRotatePartZ()
{
    if (!bGameInputEnabled) return;

    AMT_GameMode* GameMode = Cast<AMT_GameMode>(UGameplayStatics::GetGameMode(GetWorld()));
    if (GameMode && GameMode->GetSelectedPart())
    {
        FRotator Rotation = FRotator(0.0f, 0.0f, 15.0f);
        GameMode->RotateSelectedPart(Rotation);
    }
}

void AMT_PlayerController::OnPlacePart()
{
    if (!bGameInputEnabled) return;

    AMT_GameMode* GameMode = Cast<AMT_GameMode>(UGameplayStatics::GetGameMode(GetWorld()));
    if (GameMode)
    {
        GameMode->PlaceSelectedPart();
    }
}
