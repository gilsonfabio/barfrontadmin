
'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type RespostaLogin = {
    status: boolean;
    message?: string;
    token?: string;
    usuario?: {
        id: string;
        nome: string;
        email: string;
        perfil: string;
        estabelecimentoId: string;
    };
};

export default function LoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [erro, setErro] = useState('');
    const [carregando, setCarregando] = useState(false);

    async function entrar(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setErro('');
        setCarregando(true);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL;

            if (!apiUrl) {
                throw new Error(
                    'A URL da API não foi configurada no arquivo .env.local.'
                );
            }

            const resposta = await fetch(`${apiUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    senha,
                }),
            });

            const dados: RespostaLogin = await resposta.json();

            if (!resposta.ok || !dados.status || !dados.token || !dados.usuario) {
                throw new Error(
                    dados.message || 'Não foi possível realizar o login.'
                );
            }

            // Armazenamento temporário do token para o MVP.
            // Em produção, prefira sessão com cookie HttpOnly.
            sessionStorage.setItem('menuvivo_token', dados.token);
            sessionStorage.setItem(
                'menuvivo_usuario',
                JSON.stringify(dados.usuario)
            );

            const perfil = dados.usuario.perfil
                .trim()
                .toUpperCase();

            if (perfil === 'GARCOM' || perfil === 'GARÇOM') {
                router.replace('/solicitacoes-consumo');
            } else {
                router.replace('/dashboard');
            }
        } catch (error) {
            setErro(
                error instanceof Error
                    ? error.message
                    : 'Não foi possível conectar à API.'
            );
        } finally {
            setCarregando(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#101310] px-4 py-10 text-white">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#65D69A] text-3xl font-black text-[#101310]">
                        M
                    </div>

                    <h1 className="text-3xl font-bold tracking-tight">
                        MenuVivo
                    </h1>

                    <p className="mt-2 text-sm text-gray-400">
                        Administração do seu estabelecimento
                    </p>
                </div>

                <form
                    onSubmit={entrar}
                    className="space-y-5 rounded-2xl border border-white/10 bg-[#1A1E1A] p-6 shadow-2xl sm:p-8"
                >
                    <div>
                        <h2 className="text-xl font-semibold">
                            Acessar sua conta
                        </h2>

                        <p className="mt-1 text-sm text-gray-400">
                            Informe seus dados para continuar.
                        </p>
                    </div>

                    {erro && (
                        <div
                            role="alert"
                            className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                        >
                            {erro}
                        </div>
                    )}

                    <div>
                        <label
                            htmlFor="email"
                            className="mb-2 block text-sm font-medium text-gray-200"
                        >
                            E-mail
                        </label>

                        <input
                            id="email"
                            type="email"
                            autoComplete="username"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="seu@email.com"
                            required
                            className="w-full rounded-xl border border-white/10 bg-[#101310] px-4 py-3 outline-none transition focus:border-[#65D69A]"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="senha"
                            className="mb-2 block text-sm font-medium text-gray-200"
                        >
                            Senha
                        </label>

                        <input
                            id="senha"
                            type="password"
                            autoComplete="current-password"
                            value={senha}
                            onChange={(event) => setSenha(event.target.value)}
                            placeholder="Digite sua senha"
                            required
                            className="w-full rounded-xl border border-white/10 bg-[#101310] px-4 py-3 outline-none transition focus:border-[#65D69A]"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={carregando}
                        className="w-full rounded-xl bg-[#65D69A] px-4 py-3 font-bold text-[#101310] transition hover:bg-[#7BE5AC] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {carregando ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>

                <p className="mt-6 text-center text-xs text-gray-500">
                    MenuVivo · Painel administrativo
                </p>
            </div>
        </main>
    );
}
