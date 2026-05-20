#pragma once

#include "CoreMinimal.h"
#include "MT_MultiplayerManager.generated.h"

UENUM(BlueprintType)
enum class EConnectionState : uint8
{
    CS_Disconnected UMETA(DisplayName = "未连接"),
    CS_Connecting UMETA(DisplayName = "连接中"),
    CS_Connected UMETA(DisplayName = "已连接"),
    CS_InLobby UMETA(DisplayName = "在大厅"),
    CS_InGame UMETA(DisplayName = "游戏中")
};

UENUM(BlueprintType)
enum class EPlayerRole : uint8
{
    PR_Host UMETA(DisplayName = "主机"),
    PR_Client UMETA(DisplayName = "客户端"),
    PR_Spectator UMETA(DisplayName = "旁观者")
};

USTRUCT(BlueprintType)
struct FPlayerStateData
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "多人联机")
    FString PlayerID;

    UPROPERTY(BlueprintReadOnly, Category = "多人联机")
    FString PlayerName;

    UPROPERTY(BlueprintReadOnly, Category = "多人联机")
    EPlayerRole PlayerRole;

    UPROPERTY(BlueprintReadOnly, Category = "多人联机")
    FTransform CursorTransform;

    UPROPERTY(BlueprintReadOnly, Category = "多人联机")
    FString SelectedPartID;

    UPROPERTY(BlueprintReadOnly, Category = "多人联机")
    FLinearColor PlayerColor;

    UPROPERTY(BlueprintReadOnly, Category = "多人联机")
    int32 PartsPlaced;

    UPROPERTY(BlueprintReadOnly, Category = "多人联机")
    bool bIsReady;

    UPROPERTY(BlueprintReadOnly, Category = "多人联机")
    float JoinTime;
};

USTRUCT(BlueprintType)
struct FPartNetworkData
{
    GENERATED_BODY()

    UPROPERTY()
    int32 InstanceID;

    UPROPERTY()
    FString PartID;

    UPROPERTY()
    FTransform Transform;

    UPROPERTY()
    FString OwnerPlayerID;

    UPROPERTY()
    bool bIsLocked;

    UPROPERTY()
    TArray<int32> ConnectedInstanceIDs;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnPlayerJoined, const FPlayerStateData&, JoinedPlayer);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnPlayerLeft, const FPlayerStateData&, LeftPlayer);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnConnectionStateChanged, EConnectionState, NewState);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnPartPlacedByPlayer, const FPartNetworkData&, PlacedPart);

UCLASS(Blueprintable, BlueprintType)
class MORTISETENONGAME_API UMT_MultiplayerManager : public UObject
{
    GENERATED_BODY()

public:
    UMT_MultiplayerManager();

    UFUNCTION(BlueprintCallable, Category = "多人联机")
    void InitializeMultiplayer();

    UFUNCTION(BlueprintCallable, Category = "多人联机")
    bool HostSession(int32 MaxPlayers = 8);

    UFUNCTION(BlueprintCallable, Category = "多人联机")
    bool JoinSession(const FString& SessionID);

    UFUNCTION(BlueprintCallable, Category = "多人联机")
    void LeaveSession();

    UFUNCTION(BlueprintCallable, Category = "多人联机")
    void SetPlayerReady(bool bReady);

    UFUNCTION(BlueprintCallable, Category = "多人联机")
    void StartCollaborativeBuild();

    UFUNCTION(BlueprintCallable, Category = "多人联机")
    void PlacePartMultiplayer(const FPartNetworkData& PartData);

    UFUNCTION(BlueprintCallable, Category = "多人联机")
    void MovePartMultiplayer(int32 InstanceID, const FTransform& NewTransform);

    UFUNCTION(BlueprintCallable, Category = "多人联机")
    void DeletePartMultiplayer(int32 InstanceID);

    UFUNCTION(BlueprintCallable, Category = "多人联机")
    void LockPart(int32 InstanceID, bool bLock);

    UFUNCTION(BlueprintCallable, Category = "多人联机")
    void BroadcastCursorPosition(const FTransform& CursorTransform);

    UFUNCTION(BlueprintCallable, Category = "多人联机")
    void SendChatMessage(const FString& Message);

    UFUNCTION(BlueprintCallable, Category = "多人联机")
    TArray<FPlayerStateData> GetAllPlayers() const;

    UFUNCTION(BlueprintCallable, Category = "多人联机")
    EConnectionState GetConnectionState() const { return CurrentConnectionState; }

    UFUNCTION(BlueprintCallable, Category = "多人联机")
    bool IsHost() const { return bIsHost; }

    UPROPERTY(BlueprintAssignable, Category = "多人联机事件")
    FOnPlayerJoined OnPlayerJoined;

    UPROPERTY(BlueprintAssignable, Category = "多人联机事件")
    FOnPlayerLeft OnPlayerLeft;

    UPROPERTY(BlueprintAssignable, Category = "多人联机事件")
    FOnConnectionStateChanged OnConnectionStateChanged;

    UPROPERTY(BlueprintAssignable, Category = "多人联机事件")
    FOnPartPlacedByPlayer OnPartPlacedByPlayer;

    UPROPERTY(BlueprintReadOnly, Category = "多人联机")
    FString CurrentSessionID;

    UPROPERTY(BlueprintReadOnly, Category = "多人联机")
    FString LocalPlayerID;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "多人联机设置")
    float NetworkUpdateRate;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "多人联机设置")
    bool bEnableVoiceChat;

private:
    EConnectionState CurrentConnectionState;
    bool bIsHost;

    UPROPERTY()
    TMap<FString, FPlayerStateData> ConnectedPlayers;

    UPROPERTY()
    TMap<int32, FPartNetworkData> NetworkedParts;

    float LastUpdateTime;

    void UpdateConnectionState(EConnectionState NewState);
    void OnPlayerJoinedInternal(const FPlayerStateData& NewPlayer);
    void OnPlayerLeftInternal(const FString& PlayerID);
    void SyncAllPartsToNewPlayer(const FString& NewPlayerID);
};
