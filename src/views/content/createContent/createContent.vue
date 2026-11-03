<template>
    <a-flex vertical gap="10">
        <a-card>
            <a-flex justify="space-between" align="center">
                <h3 style="margin: 0;">创建/编辑内容</h3>
                <a-space class="btns">
                    <a-button @click="router.back()">返回</a-button>
                    <a-button type="primary" @click="handleSaveDraft" :disabled="isDisabled">保存草稿</a-button>
                    <a-button type="primary" @click="handleSaveCheck" :disabled="isDisabled">提交审核</a-button>
                </a-space>
            </a-flex>
        </a-card>
        <a-card title="配置">
            <a-form :model="formState" ref="formRef" :rules="rules" layout="vertical" :disabled="isDisabled">
                <a-row :gutter="16">
                    <a-col :span="24">
                        <a-form-item label="标题" name="title">
                            <a-input v-model:value="formState.title" placeholder="" />
                            <a-button type="primary" @click="handleAIGenerate"
                                :disabled="isDisabled || !formState.title"
                                style="margin-left: 10px;">输入标题AI生成内容</a-button>
                        </a-form-item>
                    </a-col>
                    <a-col :span="24">
                        <a-form-item label="标签" name="tags">
                            <a-select v-model:value="formState.tags" placeholder="" :options="[]" allow-clear
                                mode="tags" />
                        </a-form-item>
                    </a-col>
                    <a-col :span="24">
                        <a-form-item label="封面图" name="coverImage">
                            <upload-file v-model:fileList="formState.coverImage" />
                        </a-form-item>
                    </a-col>
                    <a-col :span="24">
                        <a-form-item :label="`内容(字数${formState.content.length})`" name="content">
                            <markdown-editor v-model:content="formState.content" :disabled="isDisabled" />
                        </a-form-item>
                    </a-col>
                </a-row>
            </a-form>
        </a-card>
    </a-flex>

</template>

<script setup lang="ts">
import { fetchContentDetail, fetchCreateContent, fetchEditContent } from '@/api/content/content';
import MarkdownEditor from '@/components/MarkdownEditor/MarkdownEditor.vue';
import UploadFile from '@/components/Upload/UploadFile.vue';
import { message } from 'ant-design-vue';
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const router = useRouter()
const { id, isView = '0' } = useRoute().query || { isView: '0' }

const isDisabled = computed(() => {
    return parseFloat(isView as (string)) === 1
})

const aiReply = ref('');

const formRef = ref<import('ant-design-vue').FormInstance | null>(null)
const rules = {
    tags: [
        { required: true, message: '请选择' }
    ],
    title: [
        { required: true, message: '请输入' }
    ],
    coverImage: [
        { required: false, message: '请上传' }
    ],
    content: [
        { required: true, message: '请输入' }
    ]
}

const formState = ref<{ [key: string]: any }>({
    tags: [],
    title: '',
    coverImage: [],
    content: ''
})

onBeforeMount(() => {
    if (id) {
        initData()
    }
})

async function initData() {
    const res = await fetchContentDetail(id as string)
    formState.value = {
        ...res,
        coverImage: res.cover || []
    }
}

// 保存草稿
async function handleSaveDraft() {
    await formRef.value!.validate()
    const { coverImage, ...leftProps } = formState.value
    if (!leftProps.id) {
        await fetchCreateContent({
            ...leftProps,
            cover: coverImage,
            status: 'draft'
        })
    } else {
        await fetchEditContent({
            ...leftProps,
            cover: coverImage,
            status: 'draft'
        })
    }
    message.success('保存草稿成功！')
    router.push('/content/allContent')
}

// AI生成
async function handleAIGenerate() {
    if (!formState.value.title) {
        message.warning('请输入标题！');
        return
    }
    try {
        const response = await fetch(`${import.meta.env.VITE_API_AI_URL}/content/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('accessToken') // 如果后台接口需要鉴权，fetch 可以直接加
            },
            body: JSON.stringify({
                prompt: `你是文章小助手，根据${formState.value.title}这个标题，帮我写篇300~400字文章`,
            })
        });

        if (response.status !== 200) {
            throw new Error('请求错误！')
        }

        // 2. 获取底层的流读取器（Stream Reader）
        const reader = response.body!.getReader();
        const decoder = new TextDecoder('utf-8');

        // 3. 循环读取流数据
        while (true) {
            const { done, value } = await reader.read();
            if (done) break; // 读取完毕，跳出循环

            // 将二进制数据解码为文本
            const chunk = decoder.decode(value, { stream: true });

            // SSE 返回的数据格式通常是 "data: {...}\n\n"
            // 我们需要通过正则或字符串裁剪提取出真实的 JSON 内容
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data:')) {
                    try {
                        const jsonStr = line.replace('data:', '').trim();
                        const res = JSON.parse(jsonStr);

                        // 逐字拼接到 Vue 变量中，实现打字机流式效果
                        aiReply.value += res.text;
                        console.log('res.text==', res.text);

                        console.log('aiReply==', aiReply.value);

                        formState.value.content = aiReply.value;

                    } catch (e) {
                        // 忽略可能不完整的 JSON 片段
                    }
                }
            }
        }
    } catch (error) {
        console.error('AI 通信失败:', error);
        aiReply.value = '出错了，请稍后再试。';
    } finally {
    }
}

async function handleSaveCheck() {
    await formRef.value!.validate()
    const { coverImage, ...leftProps } = formState.value
    if (!leftProps.id) {
        await fetchCreateContent({
            ...leftProps,
            cover: coverImage,
            status: 'pending'
        })
    } else {
        await fetchEditContent({
            ...leftProps,
            cover: coverImage,
            status: 'pending'
        })
    }
    message.success('提交审核成功！')
    router.push('/content/pendingReview')
}
</script>

<style scoped lang="less">
:deep(.ant-form-item-control-input-content) {
    display: flex;
}
</style>
