"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown"; // Import ReactMarkdown
import { SettingsDialog } from "@/components/settings-dialog";
import { useTranscription } from "@/hook/transcription";
import { useSummarization } from "@/hook/summarization";

export default function Page() {
  const {
    isTranscribing,
    transcription,
    modelReady,
    isMicMuted,
    isPaused: isTranscriptionPaused,
    modelLoadingProgress,
    isStarting,
    handleStartTranscription,
    handleStopTranscription,
    handlePauseTranscription,
    handleResumeTranscription,
    handleToggleMic,
  } = useTranscription();

  const {
    summaryText,
    isSummarizing,
    summarizationModelReady,
    summarizationModelLoadingProgress,
    summarizationState,
    isLoadingSummarizationModel,
    handleStartSummarization,
    interruptSummarization,
  } = useSummarization();

  const [meetingTitle, setMeetingTitle] = useState("");
  const [editableTranscription, setEditableTranscription] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  const handleStartRecording = async () => {
    await handleStartTranscription();
  };

  const handlePauseOrResumeRecording = () => {
    if (isTranscriptionPaused) {
      handleResumeTranscription();
    } else {
      handlePauseTranscription();
    }
  };

  const handleStopRecording = () => {
    handleStopTranscription();
    if (isSummarizing) {
      interruptSummarization();
    }
  };

  const handleEnhanceTranscription = async () => {
    if (
      !editableTranscription.trim() ||
      isSummarizing ||
      isLoadingSummarizationModel
    )
      return;
    await handleStartSummarization(editableTranscription, meetingTitle);
  };
  
  useEffect(() => {
    setEditableTranscription(transcription);
  }, [transcription]);

  const handleCopyMarkdown = async () => {
    if (!summaryText) return;

    try {
      await navigator.clipboard.writeText(summaryText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div className="w-full min-h-screen bg-white dark:bg-black transition-colors duration-200 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Meeting Transcription and Stuff
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Record, transcribe, and enhance your meeting conversations
        </p>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-200px)]">
        {/* Left Column - Transcription and Controls */}
        <div className="flex flex-col space-y-6">
          {/* Control Buttons */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
            {/* Meeting Title Input */}
            <div className="mb-6">
              {" "}
              {/* Increased mb for spacing */}
              <label
                htmlFor="meeting-title"
                className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Meeting Title
              </label>
              <input
                id="meeting-title"
                type="text"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="Enter meeting title (e.g., Weekly Team Standup)"
                className="w-full px-4 py-3 text-lg border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={
                  isTranscribing
                    ? handlePauseOrResumeRecording
                    : handleStartRecording
                }
                disabled={isStarting} // Only disable if actively starting; model readiness handled by click
                className={`px-6 py-3 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2 ${
                  isStarting
                    ? "bg-gray-500 cursor-not-allowed" // Disabled/loading appearance
                    : !isTranscribing
                      ? "bg-green-600 hover:bg-green-700"
                      : isTranscriptionPaused
                        ? "bg-green-600 hover:bg-green-700" // Resume button
                        : "bg-yellow-600 hover:bg-yellow-700" // Pause button
                }`}
              >
                {isStarting ? (
                  <div className="w-3 h-3 bg-white animate-pulse"></div>
                ) : !isTranscribing || isTranscriptionPaused ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4 fill-white"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4 fill-white"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                )}
                {isStarting
                  ? "Starting..." // Generic starting message
                  : !isTranscribing
                    ? "Start Recording" // Always "Start Recording" if not transcribing and not starting
                    : isTranscriptionPaused
                      ? "Resume"
                      : "Pause"}
              </button>

              <button
                onClick={handleStopRecording}
                disabled={!isTranscribing}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
              >
                <div className="w-3 h-3 bg-white"></div>
                Stop Recording
              </button>

              <button
                onClick={handleToggleMic}
                disabled={!isTranscribing || isStarting}
                className={`px-6 py-3 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2 ${
                  !isTranscribing || isStarting
                    ? "bg-gray-400 cursor-not-allowed"
                    : isMicMuted
                      ? "bg-blue-600 hover:bg-blue-700" // Unmute mic button
                      : "bg-orange-500 hover:bg-orange-600" // Mute mic button (changed to orange for distinction)
                }`}
                title={
                  !isTranscribing
                    ? "Start recording to control mic"
                    : isMicMuted
                      ? "Unmute Microphone"
                      : "Mute Microphone"
                }
              >
                {isMicMuted ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
                    />

                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m3 3 18 18"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
                    />
                  </svg>
                )}
              </button>

              <SettingsDialog />
            </div>

            {/* Status Indicator */}
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    isTranscribing
                      ? isTranscriptionPaused
                        ? "bg-yellow-500" // Paused
                        : "bg-green-500 animate-pulse" // Recording
                      : modelReady
                        ? "bg-gray-400" // Ready
                        : "bg-blue-500 animate-pulse" // Loading model
                  }`}
                ></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {isStarting
                    ? modelLoadingProgress || "Loading model..."
                    : isTranscribing
                      ? isTranscriptionPaused
                        ? `Recording Paused (Mic: ${isMicMuted ? "Muted" : "On"})`
                        : `Recording Active (Mic: ${isMicMuted ? "Muted" : "On"})`
                      : modelReady
                        ? "Ready to Record"
                        : "Click Start to Record"}
                </span>
              </div>
            </div>
          </div>

          {/* Transcription Area */}
          <div className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Live Transcription
              </h2>
              <button
                onClick={
                  isSummarizing
                    ? interruptSummarization
                    : handleEnhanceTranscription
                }
                disabled={
                  !editableTranscription.trim() ||
                  isTranscribing ||
                  (!isSummarizing && isLoadingSummarizationModel) // Disable if model is loading and not already summarizing
                }
                className={`px-4 py-2 text-white rounded-lg font-medium transition-colors duration-200 ${
                  isSummarizing
                    ? "bg-red-600 hover:bg-red-700" // "Cancel" style
                    : isLoadingSummarizationModel
                      ? "bg-gray-400 cursor-not-allowed" // Disabled/loading model style
                      : "bg-blue-600 hover:bg-blue-700" // "Enhance" style
                } disabled:bg-gray-400`}
              >
                {isSummarizing
                  ? "Cancel Summarization"
                  : isLoadingSummarizationModel
                    ? "Loading Model..."
                    : "Enhance Transcription"}
              </button>
            </div>
            <div className="h-full min-h-[300px] bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <textarea
                value={editableTranscription}
                onChange={(e) => setEditableTranscription(e.target.value)}
                placeholder="Transcription will appear here as you speak..."
                className="w-full h-full resize-none border-none outline-none bg-transparent text-gray-900 dark:text-gray-100 text-sm leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Right Column - Enhancement Output */}
        <div className="flex flex-col">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 h-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Meeting Enhancement
              </h2>
              <button
                onClick={handleCopyMarkdown}
                disabled={!summaryText}
                className={`px-4 py-2 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2 ${
                  !summaryText
                    ? "bg-gray-400 cursor-not-allowed"
                    : copySuccess
                      ? "bg-green-600"
                      : "bg-gray-600 hover:bg-gray-700"
                }`}
                title="Copy markdown text to clipboard"
              >
                {copySuccess ? (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-4 h-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-4 h-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                      />
                    </svg>
                    Copy Markdown
                  </>
                )}
              </button>
            </div>
            <div className="h-full min-h-[400px] bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 overflow-y-auto flex flex-col">
              {(isLoadingSummarizationModel && !isSummarizing) ||
              (isSummarizing && summarizationState === "thinking") ? (
                // Centered spinner for initial model loading or "thinking" state
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">
                      {isSummarizing && summarizationState === "thinking"
                        ? "Thinking..."
                        : "Loading summarization model..."}
                    </p>
                    {isSummarizing && summarizationState === "thinking" && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        The model is processing the information.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                // Display area for summary text (streaming or complete) or placeholder
                <>
                  <div
                    className="flex-grow text-gray-900 dark:text-gray-100 text-sm leading-relaxed prose dark:prose-invert" // Added prose classes for markdown styling
                  >
                    {summaryText ? (
                      <ReactMarkdown>{summaryText}</ReactMarkdown>
                    ) : (
                      !isSummarizing &&
                      !isLoadingSummarizationModel && (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-gray-500 dark:text-gray-400 text-center">
                            {summarizationModelLoadingProgress &&
                            !summarizationModelReady &&
                            !isLoadingSummarizationModel
                              ? summarizationModelLoadingProgress // Show error if loading failed
                              : "Enhanced transcription will appear here after processing."}
                            <br />
                            {!summarizationModelLoadingProgress && (
                              <span className="text-sm">
                                Click "Enhance Transcription" to get started.
                              </span>
                            )}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
