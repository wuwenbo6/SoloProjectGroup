package com.rubbing.controller;

import com.rubbing.entity.dictionary.CharacterDictionary;
import com.rubbing.service.DictionaryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/dictionary")
@CrossOrigin(origins = "*")
public class DictionaryController {

    @Autowired
    private DictionaryService dictionaryService;

    @GetMapping("/lookup/{character}")
    public ResponseEntity<CharacterDictionary> lookupCharacter(@PathVariable String character) {
        Optional<CharacterDictionary> result = dictionaryService.lookupCharacter(character);
        return result.map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/lookup/batch")
    public ResponseEntity<Map<String, CharacterDictionary>> lookupCharacters(@RequestBody List<String> characters) {
        Map<String, CharacterDictionary> results = dictionaryService.lookupCharacters(characters);
        return ResponseEntity.ok(results);
    }

    @GetMapping("/search/pinyin")
    public ResponseEntity<List<CharacterDictionary>> searchByPinyin(@RequestParam String pinyin) {
        List<CharacterDictionary> results = dictionaryService.searchByPinyin(pinyin);
        return ResponseEntity.ok(results);
    }

    @GetMapping("/search/radical")
    public ResponseEntity<List<CharacterDictionary>> findByRadical(@RequestParam String radical) {
        List<CharacterDictionary> results = dictionaryService.findByRadical(radical);
        return ResponseEntity.ok(results);
    }

    @GetMapping("/search")
    public ResponseEntity<List<CharacterDictionary>> searchByKeyword(@RequestParam String keyword) {
        List<CharacterDictionary> results = dictionaryService.searchByKeyword(keyword);
        return ResponseEntity.ok(results);
    }
}
