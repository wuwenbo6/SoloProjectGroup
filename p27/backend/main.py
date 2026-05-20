from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from loguru import logger
import os
from typing import List, Optional

from config import settings
from services.document_parser import DocumentParser
from services.ocr_service import OCRService
from services.layoutlm_service import LayoutLMService
from services.vector_store import VectorStore
from services.rag_pipeline import RAGPipeline
from services.document_diff import DocumentDiffService
from services.active_learning import ActiveLearningService
from schemas.models import (
    DocumentUploadResponse,
    QueryRequest,
    QueryResponse,
    DocumentInfo,
    DocumentDiffResponse,
    DiffStatisticsResponse,
    DiffExportRequest,
    EntityFeedbackRequest,
    FeedbackStatsResponse
)

app = FastAPI(title="企业级文档问答系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

document_parser = DocumentParser()
ocr_service = OCRService()
layoutlm_service = LayoutLMService()
vector_store = VectorStore()
rag_pipeline = RAGPipeline()
diff_service = DocumentDiffService()
active_learning_service = ActiveLearningService()


@app.on_event("startup")
async def startup_event():
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs("models", exist_ok=True)
    logger.info("应用启动完成")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("应用关闭")


@app.post("/api/upload", response_model=DocumentUploadResponse)
async def upload_document(file: UploadFile = File(...)):
    try:
        file_ext = file.filename.split(".")[-1].lower()
        if file_ext not in settings.allowed_extensions:
            raise HTTPException(status_code=400, detail=f"不支持的文件格式: {file_ext}")

        file_path = await document_parser.save_upload_file(file)

        images = await document_parser.convert_to_images(file_path)
        ocr_results = []
        for img in images:
            ocr_result = await ocr_service.extract_text_with_layout(img)
            ocr_results.append(ocr_result)

        entities = await layoutlm_service.extract_entities(ocr_results, images)

        doc_id = await vector_store.store_document(
            filename=file.filename,
            file_path=file_path,
            ocr_results=ocr_results,
            entities=entities
        )

        return DocumentUploadResponse(
            success=True,
            document_id=doc_id,
            filename=file.filename,
            entities=entities,
            message="文档上传并解析成功"
        )

    except Exception as e:
        logger.error(f"文档上传失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/query", response_model=QueryResponse)
async def query_document(request: QueryRequest):
    try:
        answer, sources = await rag_pipeline.generate_answer(
            query=request.query,
            document_id=request.document_id
        )

        return QueryResponse(
            success=True,
            answer=answer,
            sources=sources
        )

    except Exception as e:
        logger.error(f"查询失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/documents", response_model=List[DocumentInfo])
async def list_documents():
    try:
        documents = await vector_store.list_documents()
        return documents
    except Exception as e:
        logger.error(f"获取文档列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: str):
    try:
        await vector_store.delete_document(doc_id)
        return JSONResponse({"success": True, "message": "文档删除成功"})
    except Exception as e:
        logger.error(f"删除文档失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/version/upload", response_model=DocumentUploadResponse)
async def upload_revised_version(
    original_document_id: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        file_ext = file.filename.split(".")[-1].lower()
        if file_ext not in settings.allowed_extensions:
            raise HTTPException(status_code=400, detail=f"不支持的文件格式: {file_ext}")

        original_doc = await vector_store.get_document_full(original_document_id)
        if not original_doc:
            raise HTTPException(status_code=404, detail="原始文档不存在")

        file_path = await document_parser.save_upload_file(file)

        images = await document_parser.convert_to_images(file_path)
        ocr_results = []
        for img in images:
            ocr_result = await ocr_service.extract_text_with_layout(img)
            ocr_results.append(ocr_result)

        entities = await layoutlm_service.extract_entities(ocr_results, images)

        doc_id = await vector_store.store_document(
            filename=file.filename,
            file_path=file_path,
            ocr_results=ocr_results,
            entities=entities
        )

        return DocumentUploadResponse(
            success=True,
            document_id=doc_id,
            filename=file.filename,
            entities=entities,
            message="修订版文档上传并解析成功"
        )

    except Exception as e:
        logger.error(f"修订版文档上传失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/documents/compare", response_model=DocumentDiffResponse)
async def compare_documents(
    original_document_id: str = Form(...),
    revised_document_id: str = Form(...)
):
    try:
        original_doc = await vector_store.get_document_full(original_document_id)
        if not original_doc:
            raise HTTPException(status_code=404, detail="原始文档不存在")

        revised_doc = await vector_store.get_document_full(revised_document_id)
        if not revised_doc:
            raise HTTPException(status_code=404, detail="修订版文档不存在")

        diff_result = await diff_service.compare_documents(original_doc, revised_doc)
        diff_result["success"] = True
        return DocumentDiffResponse(**diff_result)

    except Exception as e:
        logger.error(f"文档对比失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/documents/compare/statistics", response_model=DiffStatisticsResponse)
async def get_diff_statistics(
    original_document_id: str = Form(...),
    revised_document_id: str = Form(...)
):
    try:
        original_doc = await vector_store.get_document_full(original_document_id)
        if not original_doc:
            raise HTTPException(status_code=404, detail="原始文档不存在")

        revised_doc = await vector_store.get_document_full(revised_document_id)
        if not revised_doc:
            raise HTTPException(status_code=404, detail="修订版文档不存在")

        diff_result = await diff_service.compare_documents(original_doc, revised_doc)
        statistics = await diff_service.generate_diff_statistics(diff_result)

        return DiffStatisticsResponse(
            success=True,
            statistics=statistics
        )

    except Exception as e:
        logger.error(f"生成对比统计失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/documents/compare/export")
async def export_diff_report(
    original_document_id: str = Form(...),
    revised_document_id: str = Form(...),
    format: str = Form(default="json")
):
    try:
        original_doc = await vector_store.get_document_full(original_document_id)
        if not original_doc:
            raise HTTPException(status_code=404, detail="原始文档不存在")

        revised_doc = await vector_store.get_document_full(revised_document_id)
        if not revised_doc:
            raise HTTPException(status_code=404, detail="修订版文档不存在")

        diff_result = await diff_service.compare_documents(original_doc, revised_doc)
        report = await diff_service.export_diff_report(diff_result, format=format)

        if format == "html":
            return Response(content=report, media_type="text/html")
        else:
            return Response(content=report, media_type="application/json")

    except Exception as e:
        logger.error(f"导出对比报告失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/feedback/submit")
async def submit_entity_feedback(request: EntityFeedbackRequest):
    try:
        feedback_id = await active_learning_service.submit_feedback(
            document_id=request.document_id,
            original_entity=request.original_entity,
            corrected_entity=request.corrected_entity,
            feedback_type=request.feedback_type,
            comment=request.comment,
            page_num=request.page_num
        )

        return JSONResponse({
            "success": True,
            "feedback_id": feedback_id,
            "message": "反馈已提交成功"
        })

    except Exception as e:
        logger.error(f"提交反馈失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/feedback/document/{document_id}")
async def get_document_feedback(document_id: str):
    try:
        feedbacks = await active_learning_service.get_feedback_by_document(document_id)
        return JSONResponse({
            "success": True,
            "document_id": document_id,
            "feedbacks": feedbacks
        })
    except Exception as e:
        logger.error(f"获取文档反馈失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/feedback/pending")
async def get_pending_feedback(limit: int = 100):
    try:
        feedbacks = await active_learning_service.get_pending_feedback(limit)
        return JSONResponse({
            "success": True,
            "feedbacks": feedbacks
        })
    except Exception as e:
        logger.error(f"获取待处理反馈失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/feedback/stats", response_model=FeedbackStatsResponse)
async def get_feedback_stats():
    try:
        stats = await active_learning_service.get_feedback_stats()
        return FeedbackStatsResponse(**stats)
    except Exception as e:
        logger.error(f"获取反馈统计失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/feedback/{feedback_id}/approve")
async def approve_feedback(feedback_id: str):
    try:
        success = await active_learning_service.approve_feedback(feedback_id)
        if not success:
            raise HTTPException(status_code=404, detail="反馈记录不存在")

        return JSONResponse({
            "success": True,
            "message": "反馈已批准"
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批准反馈失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/feedback/{feedback_id}/reject")
async def reject_feedback(feedback_id: str):
    try:
        success = await active_learning_service.reject_feedback(feedback_id)
        if not success:
            raise HTTPException(status_code=404, detail="反馈记录不存在")

        return JSONResponse({
            "success": True,
            "message": "反馈已拒绝"
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"拒绝反馈失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/feedback/{feedback_id}")
async def delete_feedback(feedback_id: str):
    try:
        success = await active_learning_service.delete_feedback(feedback_id)
        if not success:
            raise HTTPException(status_code=404, detail="反馈记录不存在")

        return JSONResponse({
            "success": True,
            "message": "反馈已删除"
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除反馈失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/training/finetune")
async def trigger_finetuning():
    try:
        result = await active_learning_service.trigger_finetuning(layoutlm_service)
        return JSONResponse(result)
    except Exception as e:
        logger.error(f"触发微调失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/training/suggestions/{document_id}")
async def get_training_suggestions(document_id: str):
    try:
        doc = await vector_store.get_document_full(document_id)
        if not doc:
            raise HTTPException(status_code=404, detail="文档不存在")

        entities = doc.get('entities', [])
        suggestions = await active_learning_service.get_training_suggestions(entities)

        return JSONResponse({
            "success": True,
            "document_id": document_id,
            "suggestions": suggestions
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取训练建议失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/training/export")
async def export_training_dataset():
    try:
        output_path = await active_learning_service.export_training_dataset()
        return JSONResponse({
            "success": True,
            "output_path": output_path,
            "message": "训练数据集已导出"
        })
    except Exception as e:
        logger.error(f"导出训练数据集失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "document-qa-system"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.debug
    )
