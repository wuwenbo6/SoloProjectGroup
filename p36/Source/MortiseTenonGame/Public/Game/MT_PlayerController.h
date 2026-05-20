#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "MT_PlayerController.generated.h"

UCLASS()
class MORTISETENONGAME_API AMT_PlayerController : public APlayerController
{
    GENERATED_BODY()

public:
    AMT_PlayerController();

    virtual void SetupInputComponent() override;

    UFUNCTION(BlueprintCallable, Category = "榫卯控制")
    void EnableGameInput();

    UFUNCTION(BlueprintCallable, Category = "榫卯控制")
    void DisableGameInput();

protected:
    virtual void BeginPlay() override;

private:
    void OnMouseLeftClick();
    void OnMouseLeftRelease();
    void OnMouseRightClick();
    void OnMouseWheelUp();
    void OnMouseWheelDown();
    void MoveForward(float Value);
    void MoveRight(float Value);
    void MoveUp(float Value);
    void RotateYaw(float Value);
    void RotatePitch(float Value);
    void OnPausePressed();
    void OnHintPressed();
    void OnRotatePartX();
    void OnRotatePartY();
    void OnRotatePartZ();
    void OnPlacePart();

    bool bGameInputEnabled;
    FVector2D LastMousePosition;
};
