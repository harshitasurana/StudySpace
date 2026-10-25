import pydantic


class RAGChunkAndSrc(pydantic.BaseModel):
    chunks: list[str]
    source_id :str=None


class RAGUpsertResults(pydantic.BaseModel):
    ingested:int

class RAGSearchResults(pydantic.BaseModel):
    contexts:list[str]
    source: list[str]

class RAGQueryResult(pydantic.BaseModel):
    answer: str
    sources: list[str]
    num_context:int