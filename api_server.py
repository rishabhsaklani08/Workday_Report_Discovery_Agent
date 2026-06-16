import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import config
from agent import ReportDiscoveryAgent
from sync_catalog import sync_from_workday

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Report Discovery Agent API")

# Initialize Agent
agent = None

@app.on_event("startup")
def startup_event():
    global agent
    logger.info("Initializing ReportDiscoveryAgent...")
    agent = ReportDiscoveryAgent()
    logger.info("Agent initialized successfully.")

# API Models
class SearchRequest(BaseModel):
    query: str
    bm25_top_n: int = 50
    llm_top_k: int = 20
    use_llm: bool = True

class SearchResponse(BaseModel):
    results: list
    message: str = ""

@app.post("/api/search")
def search_reports(req: SearchRequest):
    global agent
    if not agent:
        raise HTTPException(status_code=500, detail="Agent not initialized")
    
    try:
        if req.use_llm:
            results = agent.search(
                query=req.query,
                bm25_top_n=req.bm25_top_n,
                llm_top_k=req.llm_top_k
            )
        else:
            results = agent.search_bm25_only(
                query=req.query,
                top_n=req.llm_top_k
            )
        return {"results": results}
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sync")
def sync_reports():
    global agent
    try:
        success = sync_from_workday()
        if not success:
            raise HTTPException(status_code=500, detail="Sync failed. Check credentials or Workday RaaS URL.")
        
        # Reload agent to pick up new catalog
        logger.info("Reloading agent with new catalog...")
        agent = ReportDiscoveryAgent()
        
        return {"success": True, "message": f"Successfully synced and loaded {len(agent.catalog)} reports."}
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
def get_stats():
    global agent
    if not agent:
        raise HTTPException(status_code=500, detail="Agent not initialized")
        
    num_reports = len(agent.catalog)
    return {
        "num_reports": num_reports,
        "llm_enabled": bool(config.OPENAI_API_KEY),
        "llm_model": config.MODEL_NAME
    }

# Mount static files at the root
import os
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api_server:app", host="0.0.0.0", port=8000, reload=True)
