package com.mortise.tenon.repository;

import com.mortise.tenon.entity.HistoricalDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface HistoricalDocumentRepository extends JpaRepository<HistoricalDocument, Long> {

    Optional<HistoricalDocument> findByDocumentCode(String documentCode);

    List<HistoricalDocument> findByModelId(Long modelId);

    List<HistoricalDocument> findByDocumentType(String documentType);

    List<HistoricalDocument> findByIsVerifiedTrue();

    List<HistoricalDocument> findByDocumentTitleContaining(String keyword);
}