"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [isWebGPUSupported, setIsWebGPUSupported] = useState(null);
  const [isWebGPUCheckComplete, setIsWebGPUCheckComplete] = useState(false);
  const [webGPUCheckMessage, setWebGPUCheckMessage] = useState("");

  // Define whisperModels based on whisperModelOptions from transcription.worker.js
  // Using 'modelSlug' as the value for selection.
  const whisperModels = [
    { value: "whisper_base_f32", label: "Whisper Base f32 (Heavier)" },
    { value: "whisper_base_q4", label: "Whisper Base q4 (Lighter)" },
  ];

  const initialSettings = {
    stt: {
      whisperModel: whisperModels[0].value, // Default to the first model's slug
    },
    llm: {
      type: "local",
      localModel: "qwen3-0.6b",
      openai: {
        apiToken: "",
        baseUrl: "https://api.openai.com/v1",
        modelName: "gpt-4",
      },
    },
  };
  const [settings, setSettings] = useState(initialSettings);

  // Memoize initialSettings to prevent unnecessary re-runs of useEffect if its identity changes.
  const memoizedInitialSettings = useCallback(() => initialSettings, []);

  useEffect(() => {
    let active = true; // To prevent state updates on unmounted component

    const checkWebGPUAndLoadSettings = async () => {
      if (!active) return;
      setIsWebGPUCheckComplete(false); // Reset check status on open

      // 1. Check WebGPU
      let gpuSupported = false;
      let gpuMessage = "";
      if (typeof navigator !== "undefined" && navigator.gpu) {
        try {
          const adapter = await navigator.gpu.requestAdapter();
          if (adapter) {
            gpuSupported = true;
            gpuMessage = "WebGPU is supported.";
          } else {
            gpuMessage =
              "WebGPU is available but no adapter found. Local model disabled.";
          }
        } catch (e) {
          gpuMessage = `WebGPU not supported: ${e.message || "Unknown error"}. Local model disabled.`;
        }
      } else {
        gpuMessage =
          "WebGPU is not supported by this browser. Local model disabled.";
      }

      if (active) {
        setIsWebGPUSupported(gpuSupported);
        setWebGPUCheckMessage(gpuMessage);
        setIsWebGPUCheckComplete(true);
      }

      // 2. Load settings from localStorage
      const storedSettings = localStorage.getItem("notedPakSettings");
      // Use a deep copy of initialSettings to avoid direct mutation if it were an object passed around.
      let currentSettings = JSON.parse(
        JSON.stringify(memoizedInitialSettings()),
      );

      if (storedSettings) {
        try {
          const parsedSettings = JSON.parse(storedSettings);
          // Basic validation
          if (
            parsedSettings.stt &&
            parsedSettings.llm &&
            parsedSettings.llm.openai
          ) {
            currentSettings = parsedSettings;
          } else {
            // Invalid structure, currentSettings remains initialSettings, will save them later
            console.warn(
              "Stored settings have unexpected structure, using defaults.",
            );
            localStorage.setItem(
              "notedPakSettings",
              JSON.stringify(currentSettings),
            ); // Save valid initial settings
          }
        } catch (error) {
          console.error(
            "Failed to parse settings from localStorage, using defaults:",
            error,
          );
          // Parsing failed, currentSettings remains initialSettings, will save them later
          localStorage.setItem(
            "notedPakSettings",
            JSON.stringify(currentSettings),
          ); // Save valid initial settings
        }
      } else {
        // No settings in localStorage, save the initial settings
        localStorage.setItem(
          "notedPakSettings",
          JSON.stringify(currentSettings),
        );
      }

      // 3. Adjust settings if WebGPU is not supported and current is 'local'
      if (!gpuSupported && currentSettings.llm.type === "local") {
        currentSettings.llm.type = "openai"; // Default to OpenAI if local is chosen but not supported
      }

      if (active) {
        setSettings(currentSettings);
      }
    };

    if (open) {
      checkWebGPUAndLoadSettings();
    }

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, memoizedInitialSettings]); // memoizedInitialSettings is stable

  // const whisperModels array is now defined above initialSettings

  const localModels = [{ value: "qwen3-0.6b", label: "Qwen3 0.6B" }];

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
    localStorage.setItem("notedPakSettings", JSON.stringify(settings));
    console.log("Saving settings:", settings);
    // You could also show a toast notification here
    setOpen(false);
  };

  const handleCancel = () => {
    // Optionally, revert to saved settings if user cancels without saving
    const storedSettings = localStorage.getItem("notedPakSettings");
    if (storedSettings) {
      try {
        const parsedSettings = JSON.parse(storedSettings);
        if (parsedSettings.stt && parsedSettings.llm) {
          setSettings(parsedSettings);
        }
      } catch (error) {
        console.error(
          "Failed to parse settings from localStorage on cancel:",
          error,
        );
      }
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen} data-oid="v3lxx-b">
      <DialogTrigger asChild data-oid="smj7:zf">
        <Button
          variant="outline"
          size="icon"
          className="ml-auto"
          data-oid="fhxlozr"
        >
          <Settings className="h-4 w-4" data-oid="_m3q6pr" />
          <span className="sr-only" data-oid="01slmc_">
            Open settings
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]" data-oid="3g:w_tr">
        <DialogHeader data-oid="jga:ct9">
          <DialogTitle data-oid="kzrty-:">Settings</DialogTitle>
          <DialogDescription data-oid="4c02c29">
            Configure your speech-to-text and language model settings.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="stt" className="w-full" data-oid="io6sgc7">
          <TabsList className="grid w-full grid-cols-2" data-oid="qha1awk">
            <TabsTrigger value="stt" data-oid="co.:_to">
              Speech-to-Text
            </TabsTrigger>
            <TabsTrigger value="llm" data-oid=":1z5xve">
              Language Model
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stt" className="space-y-4" data-oid="ulsz:za">
            <div className="space-y-2" data-oid="nzx8coj">
              <Label htmlFor="whisper-model" data-oid="dlzd2jg">
                Whisper Model
              </Label>
              <Select
                value={settings.stt.whisperModel}
                onValueChange={(value) =>
                  updateSTTSettings("whisperModel", value)
                }
                data-oid="6kj-wn1"
              >
                <SelectTrigger id="whisper-model" data-oid="_na3a1m">
                  <SelectValue
                    placeholder="Select a Whisper model"
                    data-oid="au0:mp."
                  />
                </SelectTrigger>
                <SelectContent data-oid="un-pm:j">
                  {whisperModels.map((model) => (
                    <SelectItem
                      key={model.value}
                      value={model.value}
                      data-oid="cuh44xb"
                    >
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="llm" className="space-y-4" data-oid="yjv:lfr">
            <div className="space-y-4" data-oid="2swc96l">
              <Label data-oid="8osfqd6">Model Type</Label>
              <RadioGroup
                value={settings.llm.type}
                onValueChange={(value) => updateLLMSettings("type", value)}
                className="flex flex-col space-y-3"
                data-oid="ek-9173"
              >
                <div className="flex items-center space-x-2" data-oid="-58e0vu">
                  <RadioGroupItem
                    value="local"
                    id="local"
                    disabled={!isWebGPUSupported && isWebGPUCheckComplete}
                    data-oid="hrf5jy4"
                  />

                  <Label
                    htmlFor="local"
                    className={
                      !isWebGPUSupported && isWebGPUCheckComplete
                        ? "text-muted-foreground"
                        : ""
                    }
                    data-oid="1pn8gda"
                  >
                    Local Model
                  </Label>
                </div>
                {isWebGPUCheckComplete && !isWebGPUSupported && (
                  <p
                    className="ml-6 text-sm text-destructive"
                    data-oid="f7jxshh"
                  >
                    {webGPUCheckMessage ||
                      "Local model disabled due to WebGPU unavailability."}
                  </p>
                )}

                {settings.llm.type === "local" &&
                  isWebGPUSupported &&
                  isWebGPUCheckComplete && (
                    <div className="ml-6 space-y-2" data-oid="e8y_1q2">
                      <Label htmlFor="local-model" data-oid="c7l0.v4">
                        Select Local Model
                      </Label>
                      <Select
                        value={settings.llm.localModel}
                        onValueChange={(value) =>
                          updateLLMSettings("localModel", value)
                        }
                        disabled={!isWebGPUSupported} // Double ensure disabled
                        data-oid="dpnv0dj"
                      >
                        <SelectTrigger id="local-model" data-oid="uuw5kpg">
                          <SelectValue
                            placeholder="Select a local model"
                            data-oid="w4f46ka"
                          />
                        </SelectTrigger>
                        <SelectContent data-oid=".glbcis">
                          {localModels.map((model) => (
                            <SelectItem
                              key={model.value}
                              value={model.value}
                              data-oid="w.:wz4v"
                            >
                              {model.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                {/* Show this section if local is selected but WebGPU is not supported, to inform user */}
                {settings.llm.type === "local" &&
                  !isWebGPUSupported &&
                  isWebGPUCheckComplete && (
                    <div className="ml-6 space-y-2" data-oid="eyqw.u4">
                      <p
                        className="text-sm text-muted-foreground"
                        data-oid="ele91tk"
                      >
                        Local model selection is unavailable.
                      </p>
                    </div>
                  )}

                <div className="flex items-center space-x-2" data-oid="a6dcdqz">
                  <RadioGroupItem
                    value="openai"
                    id="openai"
                    data-oid="x4px6ir"
                  />
                  <Label htmlFor="openai" data-oid="h2shco2">
                    OpenAI Model
                  </Label>
                </div>

                {settings.llm.type === "openai" && (
                  <div className="ml-6 space-y-4" data-oid="empwiw3">
                    <div className="space-y-2" data-oid="4:jn_4e">
                      <Label htmlFor="api-token" data-oid=".qx95zd">
                        API Token
                      </Label>
                      <Input
                        id="api-token"
                        type="password"
                        placeholder="Enter your OpenAI API token"
                        value={settings.llm.openai.apiToken}
                        onChange={(e) =>
                          updateOpenAISettings("apiToken", e.target.value)
                        }
                        data-oid="9o3e:pg"
                      />
                    </div>

                    <div className="space-y-2" data-oid="1ducurx">
                      <Label htmlFor="base-url" data-oid="0:o_91t">
                        Base URL
                      </Label>
                      <Input
                        id="base-url"
                        placeholder="https://api.openai.com/v1"
                        value={settings.llm.openai.baseUrl}
                        onChange={(e) =>
                          updateOpenAISettings("baseUrl", e.target.value)
                        }
                        data-oid="-0znduh"
                      />
                    </div>

                    <div className="space-y-2" data-oid="oxqvx6:">
                      <Label htmlFor="model-name" data-oid="tsn-6yj">
                        Model Name
                      </Label>
                      <Input
                        id="model-name"
                        placeholder="gpt-4"
                        value={settings.llm.openai.modelName}
                        onChange={(e) =>
                          updateOpenAISettings("modelName", e.target.value)
                        }
                        data-oid="ivp6z5b"
                      />
                    </div>
                  </div>
                )}
              </RadioGroup>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end space-x-2 pt-4" data-oid="qa-5ubm">
          <Button variant="outline" onClick={handleCancel} data-oid="uiaem.5">
            Cancel
          </Button>
          <Button onClick={handleSave} data-oid="hm7a354">
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
