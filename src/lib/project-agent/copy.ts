import type { ProjectAgentLocale } from './locale'

type ProjectAgentOperationTitleCopy = {
  zh: string
  en: string
}

const PROJECT_AGENT_OPERATION_TITLE_COPY: Record<string, ProjectAgentOperationTitleCopy> = {
  register_uploaded_media: { zh: '儲存上傳素材', en: 'Save uploaded media' },
  save_project_document: { zh: '儲存專案文件', en: 'Save project document' },
  create_folder: { zh: '建立資料夾', en: 'Create folder' },
  create_image: { zh: '生成圖片資源', en: 'Generate image resource' },
  create_audio: { zh: '生成音訊資源', en: 'Generate audio resource' },
  create_video: { zh: '生成影片資源', en: 'Generate video resource' },
  merge_videos: { zh: '合併影片資源', en: 'Merge video resources' },
  rerun_failed_production_items: { zh: '重試失敗資源', en: 'Retry failed resources' },
  move_resource: { zh: '移動專案資源', en: 'Move project resource' },
  delete_resource: { zh: '刪除專案資源', en: 'Delete project resource' },
  restore_resource: { zh: '恢復專案資源', en: 'Restore project resource' },
  generate_voice: { zh: '設計角色音色', en: 'Design voice' },
  bind_voice: { zh: '綁定角色音色', en: 'Bind voice' },
  web_search: { zh: '聯網檢索', en: 'Web research' },
  list_projects: { zh: '檢視專案', en: 'List projects' },
  create_project: { zh: '建立專案', en: 'Create project' },
  get_project_basic: { zh: '讀取專案基本資訊', en: 'Read project basics' },
  update_project: { zh: '更新專案', en: 'Update project' },
  get_project_config: { zh: '讀取專案配置', en: 'Read project configuration' },
  update_project_config: { zh: '設定專案配置', en: 'Set project configuration' },
  resolve_video_proxy: { zh: '解析影片地址', en: 'Resolve video address' },
  list_download_videos: { zh: '準備影片下載', en: 'Prepare video downloads' },
  get_user_preference: { zh: '讀取使用者偏好', en: 'Read user preference' },
  update_user_preference: { zh: '更新使用者偏好', en: 'Update user preference' },
  list_user_models: { zh: '檢視可用模型', en: 'List available models' },
  list_user_transactions: { zh: '檢視交易記錄', en: 'List transactions' },
  delete_asset: { zh: '刪除資產', en: 'Delete asset' },
  generate_character_image: { zh: '生成角色圖片', en: 'Generate character image' },
  generate_location_image: { zh: '生成場景圖片', en: 'Generate location image' },
  asset_hub_list_folders: { zh: '檢視資產資料夾', en: 'List asset folders' },
  asset_hub_picker: { zh: '檢視全域資產', en: 'Browse global assets' },
  asset_hub_list_characters: { zh: '檢視全域角色', en: 'List global characters' },
  asset_hub_get_character: { zh: '讀取全域角色', en: 'Read global character' },
  asset_hub_list_locations: { zh: '檢視全域場景', en: 'List global locations' },
  asset_hub_get_location: { zh: '讀取全域場景', en: 'Read global location' },
}

export function localizeProjectAgentOperationTitle(
  operationId: string,
  locale: ProjectAgentLocale,
): string {
  return PROJECT_AGENT_OPERATION_TITLE_COPY[operationId]?.[locale]
    ?? (locale === 'en' ? 'Project operation' : '專案操作')
}
