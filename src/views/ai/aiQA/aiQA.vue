<template>
    <div class="ai-page">
        <div class="ai-upload" style="display: none;">
            <div class="ai-upload__header">
                <div class="ai-upload__title">文件上传</div>
                <div class="ai-upload__desc">支持单个表格或 PDF 文件</div>
            </div>
            <div class="ai-upload__body">
                <a-upload v-model:file-list="fileList" name="file" :max-count="1" accept=".pdf,.xls,.xlsx,.csv"
                    :before-upload="beforeUpload" :custom-request="handleUploadFile" :show-upload-list="false">
                    <a-button>
                        <template #icon>
                            <UploadOutlined />
                        </template>
                        Click to Upload
                    </a-button>
                </a-upload>
                <div class="ai-upload__hint">仅支持单个文件，格式：PDF / Excel / CSV</div>

                <div v-if="uploadedFile" class="ai-upload__file">
                    <component :is="fileIcon" class="ai-upload__file-icon" />
                    <div class="ai-upload__file-info">
                        <div class="ai-upload__file-name" :title="uploadedFile.name">{{ uploadedFile.name }}</div>
                        <div class="ai-upload__file-size">{{ formatSize(uploadedFile.size) }}</div>
                    </div>
                    <a-button type="text" danger size="small" class="ai-upload__file-remove" @click="handleRemoveFile">
                        <template #icon>
                            <DeleteOutlined />
                        </template>
                    </a-button>
                </div>

                <div v-if="uploading" class="ai-upload__progress">
                    <LoadingOutlined spin />
                    <span>上传中...</span>
                </div>
            </div>
        </div>

        <div class="ai-qa">
            <div class="ai-qa__header">
                <a-space :size="12">
                    <a-avatar :size="40" class="ai-qa__avatar">
                        <template #icon>
                            <RobotOutlined />
                        </template>
                    </a-avatar>
                    <div>
                        <div class="ai-qa__title">江苏省专升本招生计划 · 智能问答</div>
                        <div class="ai-qa__desc">关于江苏省专升本招生计划的问题尽管问我，我会为你解答</div>
                    </div>
                </a-space>
            </div>

            <div class="ai-qa__main">
                <div ref="scrollRef" class="ai-qa__body" @scroll="handleScroll">
                    <div class="ai-qa__list">
                        <div v-if="!messages.length" class="ai-qa__empty">
                            <a-avatar :size="64" class="ai-qa__avatar">
                                <template #icon>
                                    <RobotOutlined />
                                </template>
                            </a-avatar>
                            <h3>你好，我是专升本招生助手</h3>
                            <p>输入你关于江苏省专升本招生计划的问题，按 Enter 发送，我会实时为你解答</p>
                        </div>

                        <div v-for="item in messages" :key="item.id" class="message" :class="`message--${item.role}`">
                            <a-avatar v-if="item.role === 'assistant'" :size="36" class="ai-qa__avatar message__avatar">
                                <template #icon>
                                    <RobotOutlined />
                                </template>
                            </a-avatar>

                            <div class="message__bubble">
                                <template v-if="item.role === 'assistant'">
                                    <ShowMarkdown v-if="item.content" class="message__content"
                                        :content="item.content" />
                                    <div v-else class="message__typing">
                                        <LoadingOutlined spin />
                                        <span>正在思考中...</span>
                                    </div>
                                </template>
                                <div v-else class="message__content message__content--plain">{{ item.content }}</div>
                            </div>

                            <a-avatar v-if="item.role === 'user'" :size="36"
                                class="message__avatar message__avatar--user">
                                <template #icon>
                                    <UserOutlined />
                                </template>
                            </a-avatar>
                        </div>
                    </div>
                </div>

                <div class="ai-qa__tools">
                    <a-tooltip title="回到顶部" placement="left">
                        <a-button v-show="showTopBtn" shape="circle" class="ai-qa__tool-btn" @click="scrollTo('top')">
                            <template #icon>
                                <VerticalAlignTopOutlined />
                            </template>
                        </a-button>
                    </a-tooltip>
                    <a-tooltip title="回到底部" placement="left">
                        <a-button v-show="showBottomBtn" shape="circle" class="ai-qa__tool-btn"
                            @click="scrollTo('bottom')">
                            <template #icon>
                                <VerticalAlignBottomOutlined />
                            </template>
                        </a-button>
                    </a-tooltip>
                </div>
            </div>

            <div class="ai-qa__footer">
                <div class="ai-qa__input">
                    <a-textarea v-model:value="inputValue" :bordered="false" :auto-size="{ minRows: 1, maxRows: 5 }"
                        placeholder="输入关于江苏省专升本招生计划的问题，Enter 发送，Shift + Enter 换行" @keydown="handleKeydown" />
                    <a-button type="primary" class="ai-qa__send-btn" :loading="loading" :disabled="!canSend"
                        @click="handleSend">发送</a-button>
                </div>
                <div class="ai-qa__footer-tip">内容由 AI 生成，请注意甄别</div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { DeleteOutlined, FileExcelOutlined, FilePdfOutlined, LoadingOutlined, RobotOutlined, UploadOutlined, UserOutlined, VerticalAlignBottomOutlined, VerticalAlignTopOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import ShowMarkdown from '@/components/ShowMarkdown/ShowMarkdown.vue';
import { fetchUploadKB } from '@/api/kb/ai';

interface ChatMessage {
    id: number;
    role: 'user' | 'assistant';
    content: string;
}

const scrollRef = ref<HTMLElement>();
const messages = ref<ChatMessage[]>([]);
const inputValue = ref('');
const loading = ref(false);
const isNearBottom = ref(true);
const showTopBtn = ref(false);
const showBottomBtn = ref(false);
let messageId = 0;

const canSend = computed(() => !!inputValue.value.trim() && !loading.value);

// ---------------- 文件上传 ----------------
const ALLOWED_EXTS = ['.pdf', '.xls', '.xlsx', '.csv'];

interface UploadedFile {
    name: string;
    size: number;
    path: string;
}

const fileList = ref<any[]>([]);
const uploadedFile = ref<UploadedFile | null>(null);
const uploading = ref(false);

const fileIcon = computed(() =>
    uploadedFile.value?.name.toLowerCase().endsWith('.pdf') ? FilePdfOutlined : FileExcelOutlined
);

function formatSize(size: number) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function beforeUpload(file: File) {
    const reject = () => {
        // 被拒绝的文件也会被加入 fileList，需要清空避免 max-count 阻塞后续选择
        nextTick(() => {
            fileList.value = [];
        });
        return false;
    };
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
        message.error('仅支持 PDF、Excel、CSV 格式的文件');
        return reject();
    }
    if (uploadedFile.value) {
        message.warning('仅支持单个文件，请先移除已上传的文件');
        return reject();
    }
    return true;
}

async function handleUploadFile({ file, onSuccess, onError }: any) {
    const formData = new FormData();
    formData.append('file', file as File);
    uploading.value = true;
    try {
        const data = await fetchUploadKB(formData);
        uploadedFile.value = { name: file.name, size: (file as File).size, path: '12' };
        console.log(data)
        message.success('文件上传成功');
        onSuccess?.({}, file);
    } catch (error) {
        console.error('文件上传失败:', error);
        message.error('文件上传失败，请稍后重试');
        onError?.(error);
    } finally {
        uploading.value = false;
        // fileList.value = [];
    }
}

function handleRemoveFile() {
    uploadedFile.value = null;
}

// ---------------- 聊天 ----------------
function handleScroll() {
    const el = scrollRef.value;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    showTopBtn.value = el.scrollTop > 24;
    showBottomBtn.value = distance > 24;
    isNearBottom.value = distance < 40;
}

function scrollTo(position: 'top' | 'bottom') {
    const el = scrollRef.value;
    if (!el) return;
    el.scrollTo({
        top: position === 'top' ? 0 : el.scrollHeight,
        behavior: 'smooth'
    });
}

function scrollToBottom() {
    const el = scrollRef.value;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
}

function handleKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    handleSend();
}

async function handleSend() {
    const prompt = inputValue.value.trim();
    if (!prompt || loading.value) return;

    inputValue.value = '';
    messages.value.push({ id: ++messageId, role: 'user', content: prompt });
    messages.value.push({ id: ++messageId, role: 'assistant', content: '' });
    const aiIndex = messages.value.length - 1;
    const aiMessage = messages.value[aiIndex]!;

    loading.value = true;
    isNearBottom.value = true;
    await nextTick();
    scrollToBottom();
    handleScroll();

    try {
        await streamAnswer(prompt, aiIndex);
        if (!aiMessage.content) {
            aiMessage.content = '抱歉，我暂时没有找到答案，请换个问法再试试。';
        }
    } catch (error) {
        console.error('AI 问答请求失败:', error);
        aiMessage.content = '请求失败，请稍后重试。';
        message.error('AI 回复失败，请稍后重试');
    } finally {
        loading.value = false;
        await nextTick();
        handleScroll();
    }
}

async function streamAnswer(prompt: string, aiIndex: number) {
    const response = await fetch(`${import.meta.env.VITE_API_KB_URL}/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: prompt })
    });

    if (response.status !== 200 || !response.body) {
        throw new Error(`请求错误：${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach((line) => handleSSELine(line, aiIndex));
    }
    if (buffer) {
        handleSSELine(buffer, aiIndex);
    }
}

function handleSSELine(rawLine: string, aiIndex: number) {
    const line = rawLine.replace(/\r$/, '').trim();
    if (!line.startsWith('data:')) return;

    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') return;

    try {
        const data = JSON.parse(payload);
        const text = data.text ?? data.content ?? '';
        if (!text) return;

        const aiMessage = messages.value[aiIndex]!;
        aiMessage.content += text;
        nextTick(() => {
            if (isNearBottom.value) {
                scrollToBottom();
            }
            handleScroll();
        });
    } catch {
        // 忽略可能不完整的 JSON 片段
    }
}
</script>

<style scoped lang="less">
.ai-page {
    display: flex;
    gap: 16px;
    height: calc(100vh - 96px);
}

.ai-upload {
    flex-shrink: 0;
    width: 300px;
    background: #fff;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;

    &__header {
        padding: 16px 20px;
        border-bottom: 1px solid #f0f0f0;
    }

    &__title {
        font-size: 16px;
        font-weight: 600;
        color: rgba(0, 0, 0, 0.88);
    }

    &__desc {
        margin-top: 2px;
        font-size: 12px;
        color: rgba(0, 0, 0, 0.45);
    }

    &__body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 20px;
    }

    &__file {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 16px;
        padding: 10px 12px;
        border: 1px solid #f0f0f0;
        border-radius: 8px;
        background: #fafafa;
    }

    &__file-icon {
        flex-shrink: 0;
        font-size: 28px;
        color: #00b96b;
    }

    &__file-info {
        flex: 1;
        min-width: 0;
    }

    &__file-name {
        overflow: hidden;
        font-size: 13px;
        color: rgba(0, 0, 0, 0.88);
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    &__file-size {
        margin-top: 2px;
        font-size: 12px;
        color: rgba(0, 0, 0, 0.45);
    }

    &__file-remove {
        flex-shrink: 0;
    }

    &__progress {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 12px;
        font-size: 13px;
        color: rgba(0, 0, 0, 0.45);
    }

    &__hint {
        margin-top: 8px;
        font-size: 12px;
        color: rgba(0, 0, 0, 0.45);
    }
}

.ai-qa {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #fff;
    border-radius: 8px;
    overflow: hidden;

    &__header {
        flex-shrink: 0;
        padding: 16px 24px;
        border-bottom: 1px solid #f0f0f0;
    }

    &__avatar {
        background: linear-gradient(135deg, #00b96b, #36cfc9);
        color: #fff;
    }

    &__title {
        font-size: 16px;
        font-weight: 600;
        color: rgba(0, 0, 0, 0.88);
    }

    &__desc {
        margin-top: 2px;
        font-size: 12px;
        color: rgba(0, 0, 0, 0.45);
    }

    &__main {
        position: relative;
        flex: 1;
        min-height: 0;
    }

    &__body {
        height: 100%;
        overflow-y: auto;

        &::-webkit-scrollbar {
            width: 6px;
        }

        &::-webkit-scrollbar-thumb {
            background: #d9d9d9;
            border-radius: 3px;
        }
    }

    &__list {
        display: flex;
        flex-direction: column;
        gap: 20px;
        min-height: 100%;
        padding: 24px 24px 32px;
    }

    &__empty {
        display: flex;
        flex: 1;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: rgba(0, 0, 0, 0.45);

        h3 {
            margin: 16px 0 6px;
            font-size: 18px;
            color: rgba(0, 0, 0, 0.88);
        }

        p {
            margin: 0;
            font-size: 13px;
        }
    }

    &__tools {
        position: absolute;
        right: 20px;
        bottom: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    &__tool-btn {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    &__footer {
        flex-shrink: 0;
        padding: 12px 24px 8px;
        border-top: 1px solid #f0f0f0;
    }

    &__input {
        display: flex;
        align-items: flex-end;
        gap: 10px;
        padding: 8px 8px 8px 14px;
        border: 1px solid #e5e5e5;
        border-radius: 10px;
        transition: border-color 0.2s;

        &:focus-within {
            border-color: #00b96b;
        }

        :deep(.ant-input) {
            padding: 0;
            line-height: 22px;
            resize: none;
            box-shadow: none;
        }
    }

    &__send-btn {
        flex-shrink: 0;
        height: 32px;
        padding: 0 18px;
        border-radius: 8px;
    }

    &__footer-tip {
        margin-top: 6px;
        font-size: 12px;
        text-align: center;
        color: rgba(0, 0, 0, 0.35);
    }
}

.message {
    display: flex;
    align-items: flex-start;
    gap: 10px;

    &--user {
        justify-content: flex-end;
    }

    &__avatar {
        flex-shrink: 0;
    }

    &__avatar--user {
        background: #f0f0f0;
        color: rgba(0, 0, 0, 0.65);
    }

    &__bubble {
        max-width: 72%;
        padding: 10px 14px;
        border-radius: 2px 12px 12px 12px;
        background: #f5f5f5;
        color: rgba(0, 0, 0, 0.88);
    }

    &__content {
        font-size: 14px;
        line-height: 1.7;
        word-break: break-word;

        &--plain {
            white-space: pre-wrap;
        }

        :deep(p) {
            margin: 0 0 8px;
        }

        :deep(p:last-child) {
            margin-bottom: 0;
        }

        :deep(pre) {
            margin: 8px 0;
            padding: 10px 12px;
            background: #fff;
            border-radius: 6px;
            overflow-x: auto;
        }

        :deep(code) {
            padding: 1px 4px;
            background: rgba(0, 0, 0, 0.06);
            border-radius: 4px;
            font-size: 13px;
        }

        :deep(ul),
        :deep(ol) {
            margin: 0 0 8px;
            padding-left: 20px;
        }

        :deep(img) {
            max-width: 100%;
        }
    }

    &__typing {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: rgba(0, 0, 0, 0.45);
    }

    &--user &__bubble {
        border-radius: 12px 2px 12px 12px;
        background: #00b96b;
        color: #fff;
    }
}
</style>
