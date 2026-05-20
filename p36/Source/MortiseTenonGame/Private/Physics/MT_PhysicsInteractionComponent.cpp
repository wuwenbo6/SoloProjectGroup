#include "Physics/MT_PhysicsInteractionComponent.h"
#include "Components/PrimitiveComponent.h"
#include "PhysicsEngine/PhysicsConstraintComponent.h"
#include "Components/SphereComponent.h"
#include "CollisionQueryParams.h"

UMT_PhysicsInteractionComponent::UMT_PhysicsInteractionComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
    bCanSnap = true;
    bIsSnapped = false;
    bUseCCD = true;
    SnapDistanceThreshold = 8.0f;
    SnapAngleThreshold = 20.0f;
    MaxForceBeforeBreak = 5000.0f;
    JointFriction = 2.5f;
    PenetrationCorrectionStrength = 0.8f;
    JointType = EJointType::JT_Tenon;
    MatchingJointType = EJointType::JT_Mortise;
    AccumulatedForce = FVector::ZeroVector;
    PreviousVelocity = FVector::ZeroVector;
    bHasTargetPosition = false;
    bHasTargetRotation = false;

    MovementSmoothness = 1.5f;
    RotationSmoothness = 1.2f;
    LinearDamping = 0.8f;
    AngularDamping = 1.5f;
    bUseVelocityPrediction = true;
    SnapAssistStrength = 0.6f;
    GravityScale = 0.3f;
    MaxAngularVelocity = 500.0f;
}

void UMT_PhysicsInteractionComponent::BeginPlay()
{
    Super::BeginPlay();
    SetupCollisionProperties();
}

void UMT_PhysicsInteractionComponent::SetupCollisionProperties()
{
    UPrimitiveComponent* ParentComp = GetOwnerPrimitive();
    if (ParentComp)
    {
        ParentComp->SetSimulatePhysics(true);
        ParentComp->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
        ParentComp->SetCollisionProfileName(TEXT("PhysicsActor"));
        ParentComp->SetNotifyRigidBodyCollision(true);
        
        if (bUseCCD)
        {
            ParentComp->BodyInstance.bUseCCD = true;
        }
        
        ParentComp->BodyInstance.MaxDepenetrationVelocity = 500.0f;
        ParentComp->SetLinearDamping(LinearDamping);
        ParentComp->SetAngularDamping(AngularDamping);
        ParentComp->SetMaxAngularVelocityInRadians(MaxAngularVelocity * PI / 180.0f);
        ParentComp->SetMassScale(FVector(1.0f, 1.0f, GravityScale));
    }
}

void UMT_PhysicsInteractionComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    UPrimitiveComponent* ParentComp = GetOwnerPrimitive();
    if (ParentComp)
    {
        CorrectPenetration(ParentComp);
        ApplySmoothDamping(DeltaTime);
        LimitVelocity();
        
        if (bUseVelocityPrediction)
        {
            PredictVelocity(DeltaTime);
        }
    }

    if (!bIsSnapped && bCanSnap)
    {
        CheckForSnap();
        ApplySnapAssist();
    }

    UpdatePhysicsSimulation(DeltaTime);
}

UPrimitiveComponent* UMT_PhysicsInteractionComponent::GetOwnerPrimitive() const
{
    return Cast<UPrimitiveComponent>(GetAttachParent());
}

void UMT_PhysicsInteractionComponent::ApplySmoothDamping(float DeltaTime)
{
    UPrimitiveComponent* ParentComp = GetOwnerPrimitive();
    if (!ParentComp) return;

    FVector CurrentVelocity = ParentComp->GetPhysicsLinearVelocity();
    FVector DampedVelocity = CurrentVelocity * FMath::Exp(-LinearDamping * DeltaTime * MovementSmoothness);
    
    FVector SmoothedVelocity = FMath::Lerp(CurrentVelocity, DampedVelocity, DeltaTime * 5.0f);
    ParentComp->SetPhysicsLinearVelocity(SmoothedVelocity);

    FVector AngularVelocity = ParentComp->GetPhysicsAngularVelocityInDegrees();
    FVector DampedAngular = AngularVelocity * FMath::Exp(-AngularDamping * DeltaTime * RotationSmoothness);
    FVector SmoothedAngular = FMath::Lerp(AngularVelocity, DampedAngular, DeltaTime * 5.0f);
    ParentComp->SetPhysicsAngularVelocityInDegrees(SmoothedAngular);
}

void UMT_PhysicsInteractionComponent::LimitVelocity()
{
    UPrimitiveComponent* ParentComp = GetOwnerPrimitive();
    if (!ParentComp) return;

    FVector LinearVelocity = ParentComp->GetPhysicsLinearVelocity();
    float MaxLinearSpeed = 800.0f;
    
    if (LinearVelocity.Size() > MaxLinearSpeed)
    {
        LinearVelocity = LinearVelocity.GetSafeNormal() * MaxLinearSpeed;
        ParentComp->SetPhysicsLinearVelocity(LinearVelocity);
    }
}

void UMT_PhysicsInteractionComponent::PredictVelocity(float DeltaTime)
{
    UPrimitiveComponent* ParentComp = GetOwnerPrimitive();
    if (!ParentComp) return;

    FVector CurrentVelocity = ParentComp->GetPhysicsLinearVelocity();
    FVector Acceleration = (CurrentVelocity - PreviousVelocity) / FMath::Max(DeltaTime, 0.001f);
    
    FVector PredictedVelocity = CurrentVelocity + Acceleration * DeltaTime * 0.5f;
    
    PreviousVelocity = CurrentVelocity;
}

void UMT_PhysicsInteractionComponent::ApplySnapAssist()
{
    if (SnappedPartner.IsValid())
    {
        UPrimitiveComponent* ParentComp = GetOwnerPrimitive();
        UPrimitiveComponent* PartnerComp = Cast<UPrimitiveComponent>(SnappedPartner->GetAttachParent());
        
        if (ParentComp && PartnerComp)
        {
            FVector DirectionToTarget = SnappedPartner->GetComponentLocation() - GetComponentLocation();
            float Distance = DirectionToTarget.Size();
            
            if (Distance < SnapDistanceThreshold * 3.0f && Distance > 0.1f)
            {
                float AssistFactor = FMath::Clamp(1.0f - Distance / (SnapDistanceThreshold * 3.0f), 0.0f, 1.0f);
                FVector AssistForce = DirectionToTarget.GetSafeNormal() * AssistFactor * SnapAssistStrength * 1000.0f;
                ParentComp->AddForce(AssistForce);
            }
        }
    }
}

void UMT_PhysicsInteractionComponent::CheckForSnap()
{
    FCollisionQueryParams Params;
    Params.AddIgnoredActor(GetOwner());
    
    TArray<FHitResult> HitResults;
    FCollisionShape SphereShape = FCollisionShape::MakeSphere(SnapDistanceThreshold * 2.0f);
    
    bool bHit = GetWorld()->SweepMultiByChannel(
        HitResults,
        GetComponentLocation(),
        GetComponentLocation(),
        GetComponentQuat(),
        ECC_PhysicsBody,
        SphereShape,
        Params
    );

    if (bHit)
    {
        for (const FHitResult& Hit : HitResults)
        {
            AActor* HitActor = Hit.GetActor();
            if (!HitActor || HitActor == GetOwner())
            {
                continue;
            }

            UMT_PhysicsInteractionComponent* OtherJoint = HitActor->FindComponentByClass<UMT_PhysicsInteractionComponent>();
            if (OtherJoint && OtherJoint != this && !OtherJoint->IsSnapped() && OtherJoint->bCanSnap)
            {
                if (CheckJointCompatibility(OtherJoint))
                {
                    float Distance = FVector::Dist(GetComponentLocation(), OtherJoint->GetComponentLocation());
                    
                    FRotator MyRot = GetComponentRotation();
                    FRotator OtherRot = OtherJoint->GetComponentRotation();
                    float PitchDiff = FMath::Abs(FMath::FindDeltaAngleDegrees(MyRot.Pitch, OtherRot.Pitch));
                    float YawDiff = FMath::Abs(FMath::FindDeltaAngleDegrees(MyRot.Yaw, OtherRot.Yaw));
                    float RollDiff = FMath::Abs(FMath::FindDeltaAngleDegrees(MyRot.Roll, OtherRot.Roll));
                    float AngleDiff = FMath::Max3(PitchDiff, YawDiff, RollDiff);

                    if (Distance < SnapDistanceThreshold && AngleDiff < SnapAngleThreshold)
                    {
                        bIsSnapped = true;
                        SnappedPartner = OtherJoint;
                        OtherJoint->bIsSnapped = true;
                        OtherJoint->SnappedPartner = this;

                        OnJointSnapped.Broadcast(this);
                        OtherJoint->OnJointSnapped.Broadcast(OtherJoint);

                        UPhysicsConstraintComponent* Constraint = NewObject<UPhysicsConstraintComponent>(GetOwner());
                        if (Constraint)
                        {
                            Constraint->RegisterComponent();
                            Constraint->AttachToComponent(this, FAttachmentTransformRules::SnapToTargetNotIncludingScale);
                            
                            UPrimitiveComponent* ParentComp1 = Cast<UPrimitiveComponent>(GetAttachParent());
                            UPrimitiveComponent* ParentComp2 = Cast<UPrimitiveComponent>(OtherJoint->GetAttachParent());
                            
                            if (ParentComp1 && ParentComp2)
                            {
                                FVector SnapLocation = (GetComponentLocation() + OtherJoint->GetComponentLocation()) / 2.0f;
                                ParentComp1->SetWorldLocation(SnapLocation + (GetComponentLocation() - OtherJoint->GetComponentLocation()).GetSafeNormal() * 0.5f, false, nullptr, ETeleportType::TeleportPhysics);
                                
                                Constraint->SetConstrainedComponents(
                                    ParentComp1,
                                    NAME_None,
                                    ParentComp2,
                                    NAME_None
                                );
                                
                                Constraint->SetLinearXLimit(LCM_Locked, 0.0f);
                                Constraint->SetLinearYLimit(LCM_Locked, 0.0f);
                                Constraint->SetLinearZLimit(LCM_Locked, 0.0f);
                                Constraint->SetAngularSwing1Limit(ACM_Locked, 0.0f);
                                Constraint->SetAngularSwing2Limit(ACM_Locked, 0.0f);
                                Constraint->SetAngularTwistLimit(ACM_Locked, 0.0f);
                                
                                Constraint->SetLinearDriveParams(5000.0f, 1000.0f, 100.0f);
                                Constraint->SetAngularDriveParams(5000.0f, 1000.0f, 100.0f);
                                
                                Constraint->bBreakable = true;
                                Constraint->BreakForce = MaxForceBeforeBreak;
                                Constraint->BreakTorque = MaxForceBeforeBreak * 0.5f;
                                
                                ActiveConstraint = Constraint;
                                OtherJoint->ActiveConstraint = Constraint;
                            }
                        }
                        break;
                    }
                }
            }
        }
    }
}

void UMT_PhysicsInteractionComponent::CorrectPenetration(UPrimitiveComponent* Comp)
{
    if (!Comp || !Comp->IsSimulatingPhysics())
    {
        return;
    }

    FCollisionQueryParams Params;
    Params.AddIgnoredActor(GetOwner());
    Params.bTraceComplex = true;

    FVector ComponentLocation = Comp->GetComponentLocation();
    float ComponentScale = Comp->Bounds.SphereRadius * 0.5f;

    TArray<FHitResult> PenetrationHits;
    FCollisionShape SphereShape = FCollisionShape::MakeSphere(ComponentScale);
    
    bool bPenetration = GetWorld()->SweepMultiByChannel(
        PenetrationHits,
        ComponentLocation,
        ComponentLocation,
        Comp->GetComponentQuat(),
        ECC_PhysicsBody,
        SphereShape,
        Params
    );

    if (bPenetration)
    {
        FVector TotalCorrection = FVector::ZeroVector;
        int32 HitCount = 0;

        for (const FHitResult& Hit : PenetrationHits)
        {
            if (Hit.bStartPenetrating && Hit.ImpactNormal.SizeSquared() > KINDA_SMALL_NUMBER)
            {
                float PenetrationDepth = Hit.PenetrationDepth * PenetrationCorrectionStrength;
                TotalCorrection += Hit.ImpactNormal * PenetrationDepth;
                HitCount++;
            }
        }

        if (HitCount > 0)
        {
            FVector AverageCorrection = TotalCorrection / HitCount;
            if (AverageCorrection.SizeSquared() > 0.1f)
            {
                Comp->SetWorldLocation(Comp->GetComponentLocation() + AverageCorrection, false, nullptr, ETeleportType::TeleportPhysics);
                
                FVector CurrentVelocity = Comp->GetPhysicsLinearVelocity();
                float VelocityDot = FVector::DotProduct(CurrentVelocity, -AverageCorrection.GetSafeNormal());
                if (VelocityDot > 0)
                {
                    Comp->SetPhysicsLinearVelocity(CurrentVelocity * 0.3f);
                }
            }
        }
    }
}

void UMT_PhysicsInteractionComponent::UpdatePhysicsSimulation(float DeltaTime)
{
    if (bIsSnapped && SnappedPartner.IsValid())
    {
        float ForceMagnitude = AccumulatedForce.Size();
        if (ForceMagnitude > MaxForceBeforeBreak)
        {
            OnForceExceeded.Broadcast(ForceMagnitude);
            ReleaseJoint();
        }
        else
        {
            ApplyFriction();
        }
    }

    AccumulatedForce = FVector::ZeroVector;
}

void UMT_PhysicsInteractionComponent::ApplyForceToJoint(const FVector& Force)
{
    AccumulatedForce += Force;
}

void UMT_PhysicsInteractionComponent::ApplyFriction()
{
    UPrimitiveComponent* ParentComp = Cast<UPrimitiveComponent>(GetAttachParent());
    if (ParentComp && ParentComp->IsSimulatingPhysics())
    {
        FVector Velocity = ParentComp->GetPhysicsLinearVelocity();
        FVector FrictionForce = -Velocity * JointFriction;
        ParentComp->AddForce(FrictionForce);

        FVector AngularVel = ParentComp->GetPhysicsAngularVelocityInDegrees();
        FVector AngularFriction = -AngularVel * JointFriction * 0.5f;
        ParentComp->AddTorqueInDegrees(AngularFriction);
    }
}

void UMT_PhysicsInteractionComponent::ReleaseJoint()
{
    if (bIsSnapped && SnappedPartner.IsValid())
    {
        SnappedPartner->bIsSnapped = false;
        SnappedPartner->SnappedPartner = nullptr;
        bIsSnapped = false;
        SnappedPartner = nullptr;

        if (ActiveConstraint.IsValid())
        {
            ActiveConstraint->BreakConstraint();
            ActiveConstraint->DestroyComponent();
            ActiveConstraint = nullptr;
        }

        UPrimitiveComponent* ParentComp = Cast<UPrimitiveComponent>(GetAttachParent());
        if (ParentComp && ParentComp->IsSimulatingPhysics())
        {
            ParentComp->SetPhysicsLinearVelocity(ParentComp->GetPhysicsLinearVelocity() * 0.2f);
            ParentComp->SetPhysicsAngularVelocityInDegrees(ParentComp->GetPhysicsAngularVelocityInDegrees() * 0.2f);
        }
    }
    else if (ActiveConstraint.IsValid())
    {
        ActiveConstraint->BreakConstraint();
        ActiveConstraint->DestroyComponent();
        ActiveConstraint = nullptr;
    }
}

bool UMT_PhysicsInteractionComponent::CheckJointCompatibility(UMT_PhysicsInteractionComponent* OtherComponent)
{
    if (!OtherComponent)
    {
        return false;
    }
    return OtherComponent->JointType == MatchingJointType && OtherComponent->MatchingJointType == JointType;
}
