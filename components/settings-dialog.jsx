'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export function SettingsDialog() {
    const [open, setOpen] = useState(false);
    const [settings, setSettings] = useState({
        stt: {
            whisperModel: 'whisper-1',
        },
        llm: {
            type: 'local',
            localModel: 'llama-3.1-8b',
            openai: {
                apiToken: '',
                baseUrl: 'https://api.openai.com/v1',
                modelName: 'gpt-4',
            },
        },
    });

    const whisperModels = [
        { value: 'whisper-1', label: 'Whisper v1' },
        { value: 'whisper-large-v2', label: 'Whisper Large v2' },
        { value: 'whisper-large-v3', label: 'Whisper Large v3' },
        { value: 'whisper-medium', label: 'Whisper Medium' },
        { value: 'whisper-small', label: 'Whisper Small' },
        { value: 'whisper-base', label: 'Whisper Base' },
        { value: 'whisper-tiny', label: 'Whisper Tiny' },
    ];

    const localModels = [
        { value: 'llama-3.1-8b', label: 'Llama 3.1 8B' },
        { value: 'llama-3.1-70b', label: 'Llama 3.1 70B' },
        { value: 'llama-3.2-3b', label: 'Llama 3.2 3B' },
        { value: 'mistral-7b', label: 'Mistral 7B' },
        { value: 'codellama-7b', label: 'CodeLlama 7B' },
        { value: 'phi-3-mini', label: 'Phi-3 Mini' },
    ];

    const updateSTTSettings = (field, value) => {
        setSettings((prev) => ({
            ...prev,
            stt: {
                ...prev.stt,
                [field]: value,
            },
        }));
    };

    const updateLLMSettings = (field, value) => {
        setSettings((prev) => ({
            ...prev,
            llm: {
                ...prev.llm,
                [field]: value,
            },
        }));
    };

    const updateOpenAISettings = (field, value) => {
        setSettings((prev) => ({
            ...prev,
            llm: {
                ...prev.llm,
                openai: {
                    ...prev.llm.openai,
                    [field]: value,
                },
            },
        }));
    };

    const handleSave = () => {
        // Here you would typically save the settings to localStorage, a database, or send to an API
        console.log('Saving settings:', settings);
        // You could also show a toast notification here
        setOpen(false);
    };

    const handleCancel = () => {
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="ml-auto">
                    <Settings className="h-4 w-4" />
                    <span className="sr-only">Open settings</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                    <DialogDescription>
                        Configure your speech-to-text and language model settings.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="stt" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="stt">Speech-to-Text</TabsTrigger>
                        <TabsTrigger value="llm">Language Model</TabsTrigger>
                    </TabsList>

                    <TabsContent value="stt" className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="whisper-model">Whisper Model</Label>
                            <Select
                                value={settings.stt.whisperModel}
                                onValueChange={(value) => updateSTTSettings('whisperModel', value)}
                            >
                                <SelectTrigger id="whisper-model">
                                    <SelectValue placeholder="Select a Whisper model" />
                                </SelectTrigger>
                                <SelectContent>
                                    {whisperModels.map((model) => (
                                        <SelectItem key={model.value} value={model.value}>
                                            {model.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </TabsContent>

                    <TabsContent value="llm" className="space-y-4">
                        <div className="space-y-4">
                            <Label>Model Type</Label>
                            <RadioGroup
                                value={settings.llm.type}
                                onValueChange={(value) =>
                                    updateLLMSettings('type', value)
                                }
                                className="flex flex-col space-y-3"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="local" id="local" />
                                    <Label htmlFor="local">Local Model</Label>
                                </div>

                                {settings.llm.type === 'local' && (
                                    <div className="ml-6 space-y-2">
                                        <Label htmlFor="local-model">Select Local Model</Label>
                                        <Select
                                            value={settings.llm.localModel}
                                            onValueChange={(value) =>
                                                updateLLMSettings('localModel', value)
                                            }
                                        >
                                            <SelectTrigger id="local-model">
                                                <SelectValue placeholder="Select a local model" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {localModels.map((model) => (
                                                    <SelectItem
                                                        key={model.value}
                                                        value={model.value}
                                                    >
                                                        {model.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="openai" id="openai" />
                                    <Label htmlFor="openai">OpenAI Model</Label>
                                </div>

                                {settings.llm.type === 'openai' && (
                                    <div className="ml-6 space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="api-token">API Token</Label>
                                            <Input
                                                id="api-token"
                                                type="password"
                                                placeholder="Enter your OpenAI API token"
                                                value={settings.llm.openai.apiToken}
                                                onChange={(e) =>
                                                    updateOpenAISettings('apiToken', e.target.value)
                                                }
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="base-url">Base URL</Label>
                                            <Input
                                                id="base-url"
                                                placeholder="https://api.openai.com/v1"
                                                value={settings.llm.openai.baseUrl}
                                                onChange={(e) =>
                                                    updateOpenAISettings('baseUrl', e.target.value)
                                                }
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="model-name">Model Name</Label>
                                            <Input
                                                id="model-name"
                                                placeholder="gpt-4"
                                                value={settings.llm.openai.modelName}
                                                onChange={(e) =>
                                                    updateOpenAISettings(
                                                        'modelName',
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </div>
                                    </div>
                                )}
                            </RadioGroup>
                        </div>
                    </TabsContent>
                </Tabs>

                <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline" onClick={handleCancel}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>Save Settings</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
