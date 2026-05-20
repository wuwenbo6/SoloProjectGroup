import os
from typing import List, Tuple, Optional
from loguru import logger

from config import settings
from schemas.models import Source
from .numeric_validator import NumericValidator, NumericValue


class RAGPipeline:
    def __init__(self):
        self.top_k = settings.rag_top_k
        self.llm = None
        self.numeric_validator = NumericValidator()
        self.document_numerics_cache = {}
        self._init_llm()
        logger.info("RAG流水线初始化完成（已集成数值验证）")

    def _init_llm(self):
        try:
            if os.path.exists(settings.llama_model_path):
                from llama_cpp import Llama

                self.llm = Llama(
                    model_path=settings.llama_model_path,
                    n_ctx=settings.llama_n_ctx,
                    n_batch=512,
                    n_gpu_layers=settings.llama_n_gpu_layers,
                    verbose=False
                )
                logger.info("本地LLaMA模型加载完成")
            else:
                logger.warning(f"LLaMA模型文件不存在: {settings.llama_model_path}，将使用模拟模式")
                self.llm = None
        except Exception as e:
            logger.error(f"LLaMA模型加载失败: {str(e)}，将使用模拟模式")
            self.llm = None

    async def generate_answer(self, query: str, document_id: str = None) -> Tuple[str, List[Source]]:
        from .vector_store import VectorStore
        vector_store = VectorStore()

        sources = await vector_store.search_similar(
            query=query,
            document_id=document_id,
            top_k=self.top_k
        )

        if not sources:
            return "未找到相关文档内容，无法回答您的问题。", []

        context = self._build_context(sources)

        document_numerics = []
        if document_id:
            document_numerics = await self._get_document_numerics(document_id, vector_store)

        is_numeric_query = self.numeric_validator.is_numeric_question(query)

        if is_numeric_query and document_numerics:
            logger.info(f"检测到数值类问题，启用数值约束生成: {query}")
            direct_answer = await self._try_direct_numeric_answer(query, document_numerics)
            if direct_answer:
                return direct_answer, sources

            answer = await self._generate_constrained_response(
                query, context, document_numerics
            )
        else:
            answer = await self._generate_response(query, context)

        if document_numerics:
            answer = await self._validate_and_correct_answer(answer, document_numerics)

        return answer, sources

    async def _get_document_numerics(
        self, document_id: str, vector_store
    ) -> List[NumericValue]:
        if document_id in self.document_numerics_cache:
            return self.document_numerics_cache[document_id]

        full_doc = await vector_store.get_document_full(document_id)
        if full_doc and 'ocr_results' in full_doc:
            numerics = await self.numeric_validator.extract_all_numerics(full_doc['ocr_results'])
            self.document_numerics_cache[document_id] = numerics
            return numerics

        return []

    async def _try_direct_numeric_answer(
        self, query: str, document_numerics: List[NumericValue]
    ) -> Optional[str]:
        query_lower = query.lower()

        amounts = [n for n in document_numerics if n.value_type == 'amount']

        if amounts and any(k in query_lower for k in ['总金额', '总计', '合计', 'total', 'amount']):
            total_amount = sum(n.value for n in amounts)
            max_amount = max(amounts, key=lambda x: x.value)

            if len(amounts) == 1:
                return f"根据文档内容，总金额为 {amounts[0].raw_text}。"
            else:
                amount_list = '、'.join([a.raw_text for a in amounts[:5]])
                return f"根据文档内容，提取到以下金额：{amount_list}。其中最大金额为 {max_amount.raw_text}。"

        if amounts and any(k in query_lower for k in ['多少元', '多少钱', 'how much']):
            if len(amounts) == 1:
                return f"根据文档内容，金额为 {amounts[0].raw_text}。"
            else:
                amount_list = '、'.join([a.raw_text for a in amounts[:5]])
                return f"根据文档内容，提取到以下金额：{amount_list}。"

        return None

    async def _generate_constrained_response(
        self, query: str, context: str, document_numerics: List[NumericValue]
    ) -> str:
        if self.llm is not None:
            return await self._generate_with_llama_constrained(query, context, document_numerics)
        else:
            return await self._generate_simulation_constrained(query, context, document_numerics)

    async def _generate_with_llama_constrained(
        self, query: str, context: str, document_numerics: List[NumericValue]
    ) -> str:
        prompt = await self.numeric_validator.generate_constrained_prompt(
            query, context, document_numerics
        )

        try:
            output = self.llm(
                prompt,
                max_tokens=settings.llama_max_tokens,
                temperature=max(0.1, settings.llama_temperature * 0.5),
                stop=["</s>", "用户问题:", "参考文档:", "【重要规则】"],
                echo=False
            )

            answer = output['choices'][0]['text'].strip()
            return answer
        except Exception as e:
            logger.error(f"LLaMA约束生成失败: {str(e)}")
            return await self._generate_simulation_constrained(query, context, document_numerics)

    async def _generate_simulation_constrained(
        self, query: str, context: str, document_numerics: List[NumericValue]
    ) -> str:
        import re

        answer_parts = [
            f"根据文档内容分析：\n",
            f"用户问题：{query}\n\n",
            "【已启用数值验证模式】\n\n",
            "文档中提取的数值：\n"
        ]

        amounts = [n for n in document_numerics if n.value_type == 'amount']
        if amounts:
            answer_parts.append("金额数值：\n")
            for amt in amounts[:5]:
                answer_parts.append(f"  - {amt.raw_text}（上下文：{amt.context[:20]}...）\n")

        percentages = [n for n in document_numerics if n.value_type == 'percentage']
        if percentages:
            answer_parts.append("\n百分比数值：\n")
            for pct in percentages[:5]:
                answer_parts.append(f"  - {pct.raw_text}\n")

        answer_parts.append("\n检索到的关键内容：\n")
        sentences = re.split(r'[。！？\n]', context)
        relevant_sentences = [s.strip() for s in sentences if len(s.strip()) > 10][:5]

        for idx, sent in enumerate(relevant_sentences, 1):
            if sent:
                answer_parts.append(f"{idx}. {sent}\n")

        answer_parts.append("\n⚠️ 提示：所有数值均来自文档提取，未进行任何推测。")

        return "".join(answer_parts)

    async def _validate_and_correct_answer(
        self, answer: str, document_numerics: List[NumericValue]
    ) -> str:
        is_valid, valid_numerics, invalid_numerics = await self.numeric_validator.validate_answer_numerics(
            answer, document_numerics
        )

        if not is_valid and invalid_numerics:
            logger.info(f"发现未验证的数值，进行修正: {[n['value'] for n in invalid_numerics]}")
            corrected_answer = await self.numeric_validator.correct_invalid_numerics(
                answer, invalid_numerics, document_numerics
            )
            warning_note = await self.numeric_validator.generate_warning_note(invalid_numerics)
            return corrected_answer + warning_note

        return answer

    def _build_context(self, sources: List[Source]) -> str:
        context_parts = []
        for idx, source in enumerate(sources, 1):
            context_parts.append(f"[文档 {idx}] {source.filename} (第{source.page_num + 1}页):\n{source.content}\n")

        return "\n".join(context_parts)

    async def _generate_response(self, query: str, context: str) -> str:
        if self.llm is not None:
            return await self._generate_with_llama(query, context)
        else:
            return await self._generate_simulation(query, context)

    async def _generate_with_llama(self, query: str, context: str) -> str:
        prompt = f"""你是一个专业的文档问答助手。请基于以下提供的文档内容回答用户的问题。
如果文档中没有相关信息，请明确说明，不要编造信息。

参考文档:
{context}

用户问题: {query}

请给出详细、准确的回答:"""

        try:
            output = self.llm(
                prompt,
                max_tokens=settings.llama_max_tokens,
                temperature=settings.llama_temperature,
                stop=["</s>", "用户问题:", "参考文档:"],
                echo=False
            )

            return output['choices'][0]['text'].strip()
        except Exception as e:
            logger.error(f"LLaMA生成失败: {str(e)}")
            return await self._generate_simulation(query, context)

    async def _generate_simulation(self, query: str, context: str) -> str:
        import re

        answer_parts = [
            f"根据文档内容分析：\n",
            f"用户问题：{query}\n\n",
            "检索到的关键信息：\n"
        ]

        sentences = re.split(r'[。！？\n]', context)
        relevant_sentences = [s.strip() for s in sentences if len(s.strip()) > 10][:5]

        for idx, sent in enumerate(relevant_sentences, 1):
            if sent:
                answer_parts.append(f"{idx}. {sent}\n")

        answer_parts.append("\n总结：以上是从文档中检索到的相关信息。")

        return "".join(answer_parts)

    async def rerank_sources(self, query: str, sources: List[Source]) -> List[Source]:
        return sources

    def validate_answer(self, answer: str, context: str) -> bool:
        return True
