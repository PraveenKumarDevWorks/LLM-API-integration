// ─── Alternate implementation: Anthropic (Claude) ────────────────────────────
// Uncomment this block and comment out the OpenAI block below to switch providers.
// Both return the same streaming plain-text response, so page.tsx needs no changes.
//
// import Anthropic from "@anthropic-ai/sdk";
//
// const client = new Anthropic({
//     apiKey: process.env.ANTHROPIC_API_KEY,
// });
//
// /**
//  * POST /api/chat
//  * Receives the full conversation history, opens a streaming request to Claude,
//  * and pipes each text delta back to the browser as raw bytes.
//  */
// export async function POST(req: Request) {
//     const { messages } = await req.json();
//
//     // Opens a server-sent stream to Anthropic — yields chunk objects as tokens arrive.
//     const stream = await client.messages.stream({
//         model: "claude-sonnet-4-5",
//         max_tokens: 1024,
//         messages,
//     });
//
//     // Wraps the Anthropic async iterator in a Web-standard ReadableStream so
//     // Next.js can flush bytes to the browser incrementally.
//     const readable = new ReadableStream({
//         async start(controller) {
//             for await (const chunk of stream) {
//                 // Only text deltas carry visible content; other event types (ping, stop, etc.) are skipped.
//                 if (
//                     chunk.type === "content_block_delta" &&
//                     chunk.delta.type === "text_delta"
//                 ) {
//                     controller.enqueue(new TextEncoder().encode(chunk.delta.text));
//                 }
//             }
//             controller.close();
//         },
//     });
//
//     return new Response(readable, {
//         headers: {
//             "Content-Type": "text/plain; charset=utf-8",
//             "Transfer-Encoding": "chunked",
//         },
//     });
// }
// ─────────────────────────────────────────────────────────────────────────────

// ─── Active implementation: OpenAI ───────────────────────────────────────────
import OpenAI from "openai";

// Single shared OpenAI client; reads the key from the environment so it is
// never exposed to the browser.
const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/chat
 *
 * Receives the full conversation history from the frontend, forwards it to
 * OpenAI with streaming enabled, then pipes each text chunk back to the
 * browser as raw bytes so the UI can render tokens as they arrive.
 *
 * Request body:  { messages: Array<{ role: "user" | "assistant", content: string }> }
 * Response:      plain-text streaming body (Content-Type: text/plain)
 */
export async function POST(req: Request) {
    // Parse the JSON body sent by page.tsx — contains the full message history
    // so OpenAI has context for the entire conversation, not just the latest turn.
    const { messages } = await req.json();
    console.log("Received messages from frontend", messages);

    // Ask OpenAI to stream the completion. With stream: true, this returns an
    // async iterator that yields chunk objects as each token is generated.
    // NOTE: "gpt-5.4-mini" is a typo — should be "gpt-4o-mini".
    const stream = await client.chat.completions.create({
        model: "gpt-5.4-mini",
        messages,
        stream: true,
    });
    console.log("OpenAI stream opened", JSON.stringify(stream));

    // Convert the OpenAI async iterator into a Web-standard ReadableStream.
    // Next.js requires a ReadableStream (or Response) to flush bytes
    // incrementally; a regular async function would buffer the full reply first.
    const readable = new ReadableStream({
        async start(controller) {
            for await (const chunk of stream) {
                // Each chunk may or may not carry a content delta.
                // Empty deltas (role announcements, finish signals) are skipped.
                const text = chunk.choices[0]?.delta?.content || "";
                if (text) {
                    // Encode the text string to UTF-8 bytes and push it into
                    // the stream — the browser receives it immediately.
                    controller.enqueue(new TextEncoder().encode(text));
                }
            }
            // Signal end-of-stream so the browser knows the response is complete.
            controller.close();
        },
    });
    console.log("ReadableStream created", readable);

    return new Response(readable, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
}
// ─────────────────────────────────────────────────────────────────────────────
