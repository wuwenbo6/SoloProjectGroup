package com.mortise.tenon.repository;

import com.mortise.tenon.entity.MortiseTenonType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MortiseTenonTypeRepository extends JpaRepository<MortiseTenonType, Long> {

    Optional<MortiseTenonType> findByTypeCode(String typeCode);

    List<MortiseTenonType> findByCategory(String category);

    List<MortiseTenonType> findByIsActiveTrue();

    @Query("SELECT DISTINCT m.category FROM MortiseTenonType m WHERE m.isActive = true")
    List<String> findAllCategories();
}