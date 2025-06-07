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
    { value: "whisper_base_q4", label: "Whisper Base q4 (Lightest) (143 MB)" },
    { value: "whisper_base_f32", label: "Whisper Base f32 (Light) (291 MB)" },
    {
      value: "whisper_distil_small",
      label: "Whisper Distil Small (Heavy) (665 MB)",
    },
    {
      value: "whisper_small_q4",
      label: "Whisper Small q4 (Heaviest) (295 MB)",
    },
    {
      value: "whisper_distil_medium",
      label: "Whisper Distil Medium (Heavy) (1.6 GB)",
    },
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
    <Dialog open={open} onOpenChange={setOpen} data-oid="kq74pp5">
      <DialogTrigger asChild data-oid="jlxtf__">
        <Button
          variant="outline"
          size="icon"
          className="ml-auto"
          data-oid="vmtn_3g"
        >
          <Settings className="h-4 w-4" data-oid="5ko:5r1" />
          <span className="sr-only" data-oid="f.pctjo">
            Open settings
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]" data-oid="i2x4_w2">
        <DialogHeader data-oid="s:tjasw">
          <DialogTitle data-oid="-c6eew2">Settings</DialogTitle>
          <DialogDescription data-oid="lmigg8-">
            Configure your speech-to-text and language model settings.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="stt" className="w-full" data-oid="vgm:v8m">
          <TabsList className="grid w-full grid-cols-2" data-oid="jy-kp7h">
            <TabsTrigger value="stt" data-oid="mdel0p2">
              Speech-to-Text
            </TabsTrigger>
            <TabsTrigger value="llm" data-oid="p3w.b3q">
              Language Model
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stt" className="space-y-4" data-oid="jsdvw_e">
            <div className="space-y-2" data-oid="cjfr.4:">
              <Label htmlFor="whisper-model" data-oid="hesx7ln">
                Whisper Model
              </Label>
              <Select
                value={settings.stt.whisperModel}
                onValueChange={(value) =>
                  updateSTTSettings("whisperModel", value)
                }
                data-oid="oqoza50"
              >
                <SelectTrigger id="whisper-model" data-oid="2kaw2g8">
                  <SelectValue
                    placeholder="Select a Whisper model"
                    data-oid="3eadizc"
                  />
                </SelectTrigger>
                <SelectContent data-oid="985oa6-">
                  {whisperModels.map((model) => (
                    <SelectItem
                      key={model.value}
                      value={model.value}
                      data-oid="d18tnus"
                    >
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3" data-oid=".wt0a_5">
              <div className="flex items-center space-x-2" data-oid="m0dtm4b">
                <Checkbox
                  id="enable-diarization"
                  checked={settings.stt.enableDiarization}
                  onCheckedChange={(checked) =>
                    updateSTTSettings("enableDiarization", checked)
                  }
                  data-oid="5pdkhww"
                />

                <Label htmlFor="enable-diarization" data-oid="thrwpje">
                  Enable Speaker Diarization
                </Label>
              </div>
              <div className="ml-6 space-y-1" data-oid="adr4is7">
                <p
                  className="text-sm text-amber-600 dark:text-amber-400"
                  data-oid="ltlau63"
                >
                  ⚠️ Diarization is experimental and may not be reliable
                </p>
                <p className="text-sm text-muted-foreground" data-oid="wk:.ylc">
                  Uses significantly more computational resources and processing
                  time
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="llm" className="space-y-4" data-oid="rsuy5w:">
            <div className="space-y-4" data-oid="pot1rzr">
              <Label data-oid="he_dm9g">Model Type</Label>
              <RadioGroup
                value={settings.llm.type}
                onValueChange={(value) => updateLLMSettings("type", value)}
                className="flex flex-col space-y-3"
                data-oid="3o.4p_1"
              >
                <div className="flex items-center space-x-2" data-oid="0miy:0b">
                  <RadioGroupItem
                    value="local"
                    id="local"
                    disabled={!isWebGPUSupported && isWebGPUCheckComplete}
                    data-oid="w04f6qc"
                  />

                  <Label
                    htmlFor="local"
                    className={
                      !isWebGPUSupported && isWebGPUCheckComplete
                        ? "text-muted-foreground"
                        : ""
                    }
                    data-oid="_4zt:uv"
                  >
                    Local Model
                  </Label>
                </div>
                {isWebGPUCheckComplete && !isWebGPUSupported && (
                  <p
                    className="ml-6 text-sm text-destructive"
                    data-oid="0ca2pzo"
                  >
                    {webGPUCheckMessage ||
                      "Local model disabled due to WebGPU unavailability."}
                  </p>
                )}

                {settings.llm.type === "local" &&
                  isWebGPUSupported &&
                  isWebGPUCheckComplete && (
                    <div className="ml-6 space-y-2" data-oid="x1wf10s">
                      <Label htmlFor="local-model" data-oid="727mxut">
                        Select Local Model
                      </Label>
                      <Select
                        value={settings.llm.localModel}
                        onValueChange={(value) =>
                          updateLLMSettings("localModel", value)
                        }
                        disabled={!isWebGPUSupported} // Double ensure disabled
                        data-oid=":u62set"
                      >
                        <SelectTrigger id="local-model" data-oid="onua5fu">
                          <SelectValue
                            placeholder="Select a local model"
                            data-oid="z.4h6x4"
                          />
                        </SelectTrigger>
                        <SelectContent data-oid="tvtg90x">
                          {localModels.map((model) => (
                            <SelectItem
                              key={model.value}
                              value={model.value}
                              data-oid="0xh84y0"
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
                    <div className="ml-6 space-y-2" data-oid="78unqu_">
                      <p
                        className="text-sm text-muted-foreground"
                        data-oid="fz6fvn0"
                      >
                        Local model selection is unavailable.
                      </p>
                    </div>
                  )}

                <div className="flex items-center space-x-2" data-oid=":f91oo7">
                  <RadioGroupItem
                    value="openai"
                    id="openai"
                    data-oid="mrvqd94"
                  />

                  <Label htmlFor="openai" data-oid="kt2dqnf">
                    OpenAI Model
                  </Label>
                </div>

                {settings.llm.type === "openai" && (
                  <div className="ml-6 space-y-4" data-oid="oadtcpr">
                    <div className="space-y-2" data-oid="y._.9yn">
                      <Label htmlFor="api-token" data-oid="44bowuy">
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
                        data-oid="s_3h76."
                      />
                    </div>

                    <div className="space-y-2" data-oid="_ies.xz">
                      <Label htmlFor="base-url" data-oid="pmghz0b">
                        Base URL
                      </Label>
                      <Input
                        id="base-url"
                        placeholder="https://api.openai.com/v1"
                        value={settings.llm.openai.baseUrl}
                        onChange={(e) =>
                          updateOpenAISettings("baseUrl", e.target.value)
                        }
                        data-oid="bu23ul:"
                      />
                    </div>

                    <div className="space-y-2" data-oid=":962mp_">
                      <Label htmlFor="model-name" data-oid="9bm8mlv">
                        Model Name
                      </Label>
                      <Input
                        id="model-name"
                        placeholder="gpt-4"
                        value={settings.llm.openai.modelName}
                        onChange={(e) =>
                          updateOpenAISettings("modelName", e.target.value)
                        }
                        data-oid="l104pi5"
                      />
                    </div>
                  </div>
                )}
              </RadioGroup>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end space-x-2 pt-4" data-oid="yfss21n">
          <Button variant="outline" onClick={handleCancel} data-oid="e3.y5ip">
            Cancel
          </Button>
          <Button onClick={handleSave} data-oid=".er5wfb">
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
