package com.mortise.tenon.entity;

import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "t_historical_document")
public class HistoricalDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "model_id")
    private MortiseTenonModel model;

    @Column(name = "document_code", unique = true, length = 50)
    private String documentCode;

    @Column(name = "document_title", length = 300)
    private String documentTitle;

    @Column(name = "document_type", length = 50)
    private String documentType;

    @Column(name = "author", length = 200)
    private String author;

    @Column(name = "historical_period", length = 100)
    private String historicalPeriod;

    @Column(name = "publication_year", length = 50)
    private String publicationYear;

    @Column(name = "original_source", length = 500)
    private String originalSource;

    @Column(name = "file_path", length = 500)
    private String filePath;

    @Column(name = "file_format", length = 20)
    private String fileFormat;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "page_count")
    private Integer pageCount;

    @Column(name = "thumbnail_path", length = 500)
    private String thumbnailPath;

    @Column(name = "summary", columnDefinition = "TEXT")
    private String summary;

    @Column(name = "content_extract", columnDefinition = "TEXT")
    private String contentExtract;

    @Column(name = "key_references", columnDefinition = "TEXT")
    private String keyReferences;

    @Column(name = "is_verified")
    private Boolean isVerified = false;

    @Column(name = "view_count")
    private Integer viewCount = 0;

    @CreationTimestamp
    @Column(name = "create_time", updatable = false)
    private LocalDateTime createTime;

    @UpdateTimestamp
    @Column(name = "update_time")
    private LocalDateTime updateTime;
}