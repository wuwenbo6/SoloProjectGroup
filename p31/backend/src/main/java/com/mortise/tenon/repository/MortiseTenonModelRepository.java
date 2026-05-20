package com.mortise.tenon.repository;

import com.mortise.tenon.entity.MortiseTenonModel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MortiseTenonModelRepository extends JpaRepository<MortiseTenonModel, Long> {

    Optional<MortiseTenonModel> findByModelCode(String modelCode);

    List<MortiseTenonModel> findByTypeId(Long typeId);

    Page<MortiseTenonModel> findByTypeId(Long typeId, Pageable pageable);

    List<MortiseTenonModel> findByIsPublishedTrue();

    Page<MortiseTenonModel> findByIsPublished(Boolean published, Pageable pageable);

    List<MortiseTenonModel> findByAncientBuildingNameContaining(String buildingName);

    @Query("SELECT m FROM MortiseTenonModel m WHERE m.isPublished = true " +
           "AND (:keyword IS NULL OR m.name LIKE %:keyword% " +
           "OR m.ancientBuildingName LIKE %:keyword% OR m.description LIKE %:keyword%)")
    List<MortiseTenonModel> searchByKeyword(@Param("keyword") String keyword);

    @Query("SELECT m FROM MortiseTenonModel m WHERE m.id IN :ids")
    List<MortiseTenonModel> findByIds(@Param("ids") List<Long> ids);

    @Query("SELECT DISTINCT m.ancientBuildingName FROM MortiseTenonModel m WHERE m.isPublished = true")
    List<String> findAllBuildingNames();

    @Query("SELECT m FROM MortiseTenonModel m WHERE m.typeId = :typeId AND m.isPublished = :published")
    Page<MortiseTenonModel> findByTypeIdAndPublished(@Param("typeId") Long typeId, @Param("published") Boolean published, Pageable pageable);

    @Query("SELECT m FROM MortiseTenonModel m WHERE m.typeId = :typeId AND (m.name LIKE %:keyword% OR m.ancientBuildingName LIKE %:keyword%)")
    Page<MortiseTenonModel> findByTypeIdAndKeyword(@Param("typeId") Long typeId, @Param("keyword") String keyword, Pageable pageable);

    @Query("SELECT m FROM MortiseTenonModel m WHERE m.isPublished = :published AND (m.name LIKE %:keyword% OR m.ancientBuildingName LIKE %:keyword%)")
    Page<MortiseTenonModel> findByPublishedAndKeyword(@Param("published") Boolean published, @Param("keyword") String keyword, Pageable pageable);

    @Query("SELECT m FROM MortiseTenonModel m WHERE m.typeId = :typeId AND m.isPublished = :published AND (m.name LIKE %:keyword% OR m.ancientBuildingName LIKE %:keyword%)")
    Page<MortiseTenonModel> findByTypeIdAndPublishedAndKeyword(@Param("typeId") Long typeId, @Param("published") Boolean published, @Param("keyword") String keyword, Pageable pageable);

    @Query("SELECT m FROM MortiseTenonModel m WHERE m.name LIKE %:keyword% OR m.ancientBuildingName LIKE %:keyword% OR m.description LIKE %:keyword%")
    Page<MortiseTenonModel> findByKeyword(@Param("keyword") String keyword, Pageable pageable);
}