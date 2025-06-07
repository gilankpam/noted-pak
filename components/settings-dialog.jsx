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
import { Checkbox } from "@/components/ui/checkbox";

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
      enableDiarization: false,
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

  const localModels = [
    { value: "qwen3-0.6b", label: "Qwen3 0.6B" },
    { value: "smollm2-1.7b", label: "SmolLM2 1.7B" },
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
    <Dialog open={open} onOpenChange={setOpen} data-oid="krsis:v">
      <DialogTrigger asChild data-oid="9dangs3">
        <Button
          variant="outline"
          size="icon"
          className="ml-auto"
          data-oid="h435x6o"
        >
          <Settings className="h-4 w-4" data-oid="q2owkiq" />
          <span className="sr-only" data-oid="va39iwh">
            Open settings
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]" data-oid="hl.z90r">
        <DialogHeader data-oid="e9krof-">
          <DialogTitle data-oid="y47ywgb">Settings</DialogTitle>
          <DialogDescription data-oid="qwp.6zm">
            Configure your speech-to-text and language model settings.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="stt" className="w-full" data-oid="gxk0agr">
          <TabsList className="grid w-full grid-cols-2" data-oid="smksn2q">
            <TabsTrigger value="stt" data-oid="aq1tsyp">
              Speech-to-Text
            </TabsTrigger>
            <TabsTrigger value="llm" data-oid="_rtsw37">
              Language Model
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stt" className="space-y-4" data-oid="d33ow-d">
            <div className="space-y-2" data-oid="ewsgz8.">
              <Label htmlFor="whisper-model" data-oid=":5:q55y">
                Whisper Model
              </Label>
              <Select
                value={settings.stt.whisperModel}
                onValueChange={(value) =>
                  updateSTTSettings("whisperModel", value)
                }
                data-oid="4_-v_m1"
              >
                <SelectTrigger id="whisper-model" data-oid="60_cj1d">
                  <SelectValue
                    placeholder="Select a Whisper model"
                    data-oid="sytz5qp"
                  />
                </SelectTrigger>
                <SelectContent data-oid="jtpy9vt">
                  {whisperModels.map((model) => (
                    <SelectItem
                      key={model.value}
                      value={model.value}
                      data-oid="t.k31lh"
                    >
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3" data-oid="diarization-section">
              <div
                className="flex items-center space-x-2"
                data-oid="diarization-checkbox"
              >
                <Checkbox
                  id="enable-diarization"
                  checked={settings.stt.enableDiarization}
                  onCheckedChange={(checked) =>
                    updateSTTSettings("enableDiarization", checked)
                  }
                  data-oid="diarization-input"
                />

                <Label
                  htmlFor="enable-diarization"
                  data-oid="diarization-label"
                >
                  Enable Speaker Diarization
                </Label>
              </div>
              <div className="ml-6 space-y-1" data-oid="diarization-warning">
                <p
                  className="text-sm text-amber-600 dark:text-amber-400"
                  data-oid="warning-text"
                >
                  ⚠️ Diarization is experimental and may not be reliable
                </p>
                <p
                  className="text-sm text-muted-foreground"
                  data-oid="resource-text"
                >
                  Uses significantly more computational resources and processing
                  time
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="llm" className="space-y-4" data-oid="gimnth6">
            <div className="space-y-4" data-oid="jv-hk73">
              <Label data-oid="mlqgrqp">Model Type</Label>
              <RadioGroup
                value={settings.llm.type}
                onValueChange={(value) => updateLLMSettings("type", value)}
                className="flex flex-col space-y-3"
                data-oid=".pw3-di"
              >
                <div className="flex items-center space-x-2" data-oid="t-wfhnt">
                  <RadioGroupItem
                    value="local"
                    id="local"
                    disabled={!isWebGPUSupported && isWebGPUCheckComplete}
                    data-oid="nk54zra"
                  />

                  <Label
                    htmlFor="local"
                    className={
                      !isWebGPUSupported && isWebGPUCheckComplete
                        ? "text-muted-foreground"
                        : ""
                    }
                    data-oid="lwm8xm:"
                  >
                    Local Model
                  </Label>
                </div>
                {isWebGPUCheckComplete && !isWebGPUSupported && (
                  <p
                    className="ml-6 text-sm text-destructive"
                    data-oid="lfs16nu"
                  >
                    {webGPUCheckMessage ||
                      "Local model disabled due to WebGPU unavailability."}
                  </p>
                )}

                {settings.llm.type === "local" &&
                  isWebGPUSupported &&
                  isWebGPUCheckComplete && (
                    <div className="ml-6 space-y-2" data-oid="8ov39o1">
                      <Label htmlFor="local-model" data-oid="yyojj_g">
                        Select Local Model
                      </Label>
                      <Select
                        value={settings.llm.localModel}
                        onValueChange={(value) =>
                          updateLLMSettings("localModel", value)
                        }
                        disabled={!isWebGPUSupported} // Double ensure disabled
                        data-oid="gdfx-:l"
                      >
                        <SelectTrigger id="local-model" data-oid="s3ng0mj">
                          <SelectValue
                            placeholder="Select a local model"
                            data-oid="wis8xk9"
                          />
                        </SelectTrigger>
                        <SelectContent data-oid="kvg-1v:">
                          {localModels.map((model) => (
                            <SelectItem
                              key={model.value}
                              value={model.value}
                              data-oid="w4pbb8i"
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
                    <div className="ml-6 space-y-2" data-oid="fgmp11-">
                      <p
                        className="text-sm text-muted-foreground"
                        data-oid="92hty48"
                      >
                        Local model selection is unavailable.
                      </p>
                    </div>
                  )}

                <div className="flex items-center space-x-2" data-oid="0s9fidz">
                  <RadioGroupItem
                    value="openai"
                    id="openai"
                    data-oid="e-p6-h7"
                  />

                  <Label htmlFor="openai" data-oid="rn2oaz.">
                    OpenAI Model
                  </Label>
                </div>

                {settings.llm.type === "openai" && (
                  <div className="ml-6 space-y-4" data-oid="en_ugjj">
                    <div className="space-y-2" data-oid="vefl60v">
                      <Label htmlFor="api-token" data-oid="_neouq.">
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
                        data-oid="b1oc1qz"
                      />
                    </div>

                    <div className="space-y-2" data-oid="11oc:p9">
                      <Label htmlFor="base-url" data-oid="auc_vet">
                        Base URL
                      </Label>
                      <Input
                        id="base-url"
                        placeholder="https://api.openai.com/v1"
                        value={settings.llm.openai.baseUrl}
                        onChange={(e) =>
                          updateOpenAISettings("baseUrl", e.target.value)
                        }
                        data-oid="jpzhytq"
                      />
                    </div>

                    <div className="space-y-2" data-oid="pzm8o-m">
                      <Label htmlFor="model-name" data-oid="jyxjfu4">
                        Model Name
                      </Label>
                      <Input
                        id="model-name"
                        placeholder="gpt-4"
                        value={settings.llm.openai.modelName}
                        onChange={(e) =>
                          updateOpenAISettings("modelName", e.target.value)
                        }
                        data-oid="sz259qg"
                      />
                    </div>
                  </div>
                )}
              </RadioGroup>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end space-x-2 pt-4" data-oid="w2fk-7y">
          <Button variant="outline" onClick={handleCancel} data-oid=":nk33i_">
            Cancel
          </Button>
          <Button onClick={handleSave} data-oid="i0r__1o">
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
