#include "MortiseTenon/MT_MortiseTenonPart.h"
#include "Components/StaticMeshComponent.h"

AMT_MortiseTenonPart::AMT_MortiseTenonPart()
{
    PrimaryActorTick.bCanEverTick = true;

    MeshComponent = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("MeshComponent"));
    RootComponent = MeshComponent;
    MeshComponent->SetSimulatePhysics(false);
    MeshComponent->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
    MeshComponent->SetCollisionProfileName(TEXT("PhysicsActor"));

    PhysicsComponent = CreateDefaultSubobject<UMT_PhysicsInteractionComponent>(TEXT("PhysicsComponent"));
    PhysicsComponent->SetupAttachment(RootComponent);

    bIsSelected = false;
    bIsPlaced = false;
    bCanBeMoved = true;
    bCanBeRotated = true;
    Weight = 1.0f;
    Difficulty = EPartDifficulty::PD_Easy;
}

void AMT_MortiseTenonPart::BeginPlay()
{
    Super::BeginPlay();
    
    InitialPosition = GetActorLocation();
    InitialRotation = GetActorRotation();
}

void AMT_MortiseTenonPart::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);
}

void AMT_MortiseTenonPart::OnConstruction(const FTransform& Transform)
{
    Super::OnConstruction(Transform);
}

void AMT_MortiseTenonPart::SelectPart()
{
    if (!bIsSelected)
    {
        bIsSelected = true;
        OnPartSelected.Broadcast();
    }
}

void AMT_MortiseTenonPart::DeselectPart()
{
    if (bIsSelected)
    {
        bIsSelected = false;
        OnPartDeselected.Broadcast();
    }
}

void AMT_MortiseTenonPart::SetPartPosition(const FVector& NewPosition)
{
    if (bCanBeMoved && !bIsPlaced)
    {
        SetActorLocation(NewPosition);
    }
}

void AMT_MortiseTenonPart::SetPartRotation(const FRotator& NewRotation)
{
    if (bCanBeRotated && !bIsPlaced)
    {
        SetActorRotation(NewRotation);
    }
}

void AMT_MortiseTenonPart::RotatePart(const FRotator& DeltaRotation)
{
    if (bCanBeRotated && !bIsPlaced)
    {
        AddActorLocalRotation(DeltaRotation);
    }
}

void AMT_MortiseTenonPart::PlacePart()
{
    if (!bIsPlaced)
    {
        bIsPlaced = true;
        bCanBeMoved = false;
        bCanBeRotated = false;
        
        MeshComponent->SetSimulatePhysics(true);
        MeshComponent->WakeAllRigidBodies();
        
        OnPartPlaced.Broadcast();
    }
}

void AMT_MortiseTenonPart::ResetPart()
{
    bIsPlaced = false;
    bCanBeMoved = true;
    bCanBeRotated = true;
    bIsSelected = false;
    
    SetActorLocationAndRotation(InitialPosition, InitialRotation);
    
    MeshComponent->SetSimulatePhysics(false);
    
    PhysicsComponent->ReleaseJoint();
}
