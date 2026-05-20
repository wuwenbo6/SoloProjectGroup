package com.rubbing.repository;

import com.rubbing.entity.dictionary.CharacterDictionary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CharacterDictionaryRepository extends JpaRepository<CharacterDictionary, Long> {

    Optional<CharacterDictionary> findByCharacter(String character);

    @Query("SELECT c FROM CharacterDictionary c WHERE c.character IN :characters")
    List<CharacterDictionary> findByCharactersIn(@Param("characters") List<String> characters);

    @Query("SELECT c FROM CharacterDictionary c WHERE LOWER(c.pinyin) LIKE LOWER(CONCAT('%', :pinyin, '%'))")
    List<CharacterDictionary> findByPinyinContaining(@Param("pinyin") String pinyin);

    @Query("SELECT c FROM CharacterDictionary c WHERE c.radical = :radical")
    List<CharacterDictionary> findByRadical(@Param("radical") String radical);

    @Query("SELECT c FROM CharacterDictionary c WHERE LOWER(c.definition) LIKE LOWER(CONCAT('%', :keyword, '%'))")
    List<CharacterDictionary> searchByDefinition(@Param("keyword") String keyword);
}
