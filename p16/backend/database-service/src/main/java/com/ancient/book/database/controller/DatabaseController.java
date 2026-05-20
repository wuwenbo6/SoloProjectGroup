package com.ancient.book.database.controller;

import com.ancient.book.common.entity.AncientBookPage;
import com.ancient.book.common.entity.Interpretation;
import com.ancient.book.common.entity.RestorationDraft;
import com.ancient.book.database.service.AncientBookPageService;
import com.ancient.book.database.service.InterpretationService;
import com.ancient.book.database.service.RestorationDraftService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/database")
@RequiredArgsConstructor
public class DatabaseController {

    private final AncientBookPageService pageService;
    private final RestorationDraftService draftService;
    private final InterpretationService interpretationService;

    @PostMapping("/page")
    public ResponseEntity<AncientBookPage> savePage(@RequestBody AncientBookPage page) {
        AncientBookPage savedPage = pageService.savePage(page);
        return ResponseEntity.ok(savedPage);
    }

    @GetMapping("/page/{id}")
    public ResponseEntity<AncientBookPage> getPageById(@PathVariable Long id) {
        AncientBookPage page = pageService.getPageById(id);
        return ResponseEntity.ok(page);
    }

    @GetMapping("/page/list")
    public ResponseEntity<IPage<AncientBookPage>> getPageList(
            @RequestParam(defaultValue = "1") int current,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String bookName) {
        IPage<AncientBookPage> pageList = pageService.getPageList(current, size, bookName);
        return ResponseEntity.ok(pageList);
    }

    @GetMapping("/page/book/{bookName}")
    public ResponseEntity<List<AncientBookPage>> getPagesByBookName(@PathVariable String bookName) {
        List<AncientBookPage> pages = pageService.getPagesByBookName(bookName);
        return ResponseEntity.ok(pages);
    }

    @PutMapping("/page")
    public ResponseEntity<AncientBookPage> updatePage(@RequestBody AncientBookPage page) {
        AncientBookPage updatedPage = pageService.updatePage(page);
        return ResponseEntity.ok(updatedPage);
    }

    @DeleteMapping("/page/{id}")
    public ResponseEntity<Void> deletePage(@PathVariable Long id) {
        pageService.deletePage(id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/page/{id}/status")
    public ResponseEntity<Void> updatePageStatus(@PathVariable Long id, @RequestBody Map<String, Integer> request) {
        pageService.updatePageStatus(id, request.get("status"));
        return ResponseEntity.ok().build();
    }

    @PutMapping("/page/{id}/damage")
    public ResponseEntity<Void> saveDamageAreas(@PathVariable Long id, @RequestBody Map<String, String> request) {
        pageService.saveDamageAreas(id, request.get("damageAreas"));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/draft")
    public ResponseEntity<RestorationDraft> saveDraft(@RequestBody RestorationDraft draft) {
        RestorationDraft savedDraft = draftService.saveDraft(draft);
        return ResponseEntity.ok(savedDraft);
    }

    @GetMapping("/draft/{id}")
    public ResponseEntity<RestorationDraft> getDraftById(@PathVariable Long id) {
        RestorationDraft draft = draftService.getDraftById(id);
        return ResponseEntity.ok(draft);
    }

    @GetMapping("/draft/page/{pageId}")
    public ResponseEntity<List<RestorationDraft>> getDraftsByPageId(@PathVariable Long pageId) {
        List<RestorationDraft> drafts = draftService.getDraftsByPageId(pageId);
        return ResponseEntity.ok(drafts);
    }

    @PutMapping("/draft")
    public ResponseEntity<RestorationDraft> updateDraft(@RequestBody RestorationDraft draft) {
        RestorationDraft updatedDraft = draftService.updateDraft(draft);
        return ResponseEntity.ok(updatedDraft);
    }

    @PutMapping("/draft/{id}/ai-suggestions")
    public ResponseEntity<Void> saveAiSuggestions(@PathVariable Long id, @RequestBody Map<String, String> request) {
        draftService.saveAiSuggestions(id, request.get("aiSuggestions"));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/interpretation")
    public ResponseEntity<Interpretation> saveInterpretation(@RequestBody Interpretation interpretation) {
        Interpretation saved = interpretationService.saveInterpretation(interpretation);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/interpretation/{id}")
    public ResponseEntity<Interpretation> getInterpretationById(@PathVariable Long id) {
        Interpretation interpretation = interpretationService.getInterpretationById(id);
        return ResponseEntity.ok(interpretation);
    }

    @GetMapping("/interpretation/search")
    public ResponseEntity<List<Interpretation>> searchByAncientText(@RequestParam String ancientText) {
        List<Interpretation> interpretations = interpretationService.searchByAncientText(ancientText);
        return ResponseEntity.ok(interpretations);
    }

    @GetMapping("/interpretation/list")
    public ResponseEntity<IPage<Interpretation>> getInterpretationList(
            @RequestParam(defaultValue = "1") int current,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword) {
        IPage<Interpretation> list = interpretationService.getInterpretationList(current, size, keyword);
        return ResponseEntity.ok(list);
    }
}
