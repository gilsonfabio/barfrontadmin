'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Usuario = {
    id: string;
    nome: string;
    email: string;
    perfil: string;
    estabelecimentoId: string;
};

export default function DashboardPage() {
    const router = useRouter();
    const [usuario, setUsuario] = useState<Usuario | null>(null);
    const [verificando, setVerificando] = useState(true);

    useEffect(() => {
        const token = sessionStorage.getItem('menuvivo_token');
        const usuarioSalvo = sessionStorage.getItem('menuvivo_usuario');

        if (!token || !usuarioSalvo) {
            router.replace('/login');
            return;
        }

        try {
            setUsuario(JSON.parse(usuarioSalvo) as Usuario);
        } catch {
            sessionStorage.removeItem('menuvivo_token');
            sessionStorage.removeItem('menuvivo_usuario');
            router.replace('/login');
        } finally {
            setVerificando(false);
        }
    }, [router]);

    function sair() {
        sessionStorage.removeItem('menuvivo_token');
        sessionStorage.removeItem('menuvivo_usuario');
        router.replace('/login');
    }

    if (verificando || !usuario) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#101310] text-gray-300">
                Carregando painel...
            </main>
        );
    }

    const modulos = [
        {
            titulo: 'Mesas e QR Codes',
            descricao: 'Gerencie mesas e prepare os códigos para impressão.',
            href: '/mesas',
            icone: '▦',
        },
        {
            titulo: 'Categorias',
            descricao: 'Organize as categorias principais do cardápio.',
            href: '/categorias',
            icone: '☷',
        },
        {
            titulo: 'Subcategorias',
            descricao: 'Organize os produtos dentro de cada categoria.',
            href: '/subcategorias',
            icone: '≡',
        },
        {
            titulo: 'Produtos',
            descricao: 'Cadastre produtos, preços, imagens e destaques.',
            href: '/produtos',
            icone: '◈',
        },
        {
            titulo: 'Pedidos',
            descricao: 'Acompanhe os pedidos dos clientes.',
            href: '/pedidos',
            icone: '≋',
        },
        {
            titulo: 'Solicitações de consumo',
            descricao: 'Confirme ou rejeite solicitações recebidas das mesas.',
            href: '/solicitacoes-consumo',
            icone: '✓',
        },
    ];

    return (
        <main className="min-h-screen bg-[#101310] text-white">
            <header className="border-b border-white/10 bg-[#1A1E1A]">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
                    <div>
                        <h1 className="text-xl font-bold">
                            Menu<span className="text-[#65D69A]">Vivo</span>
                        </h1>

                        <p className="text-xs text-gray-400">
                            Painel administrativo
                        </p>
                    </div>

                    <button
                        onClick={sair}
                        className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
                    >
                        Sair
                    </button>
                </div>
            </header>

            <section className="mx-auto max-w-7xl px-5 py-10">
                <p className="text-sm text-[#65D69A]">
                    VISÃO GERAL
                </p>

                <h2 className="mt-2 text-3xl font-bold">
                    Olá, {usuario.nome}
                </h2>

                <p className="mt-2 text-gray-400">
                    Selecione uma área para administrar seu estabelecimento.
                </p>

                <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {modulos.map((modulo) => (
                        <a
                            key={modulo.href}
                            href={modulo.href}
                            className="rounded-2xl border border-white/10 bg-[#1A1E1A] p-5 transition hover:border-[#65D69A]/60 hover:bg-[#202620]"
                        >
                            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#65D69A]/10 text-2xl text-[#65D69A]">
                                {modulo.icone}
                            </div>

                            <h3 className="font-semibold">
                                {modulo.titulo}
                            </h3>

                            <p className="mt-2 text-sm leading-6 text-gray-400">
                                {modulo.descricao}
                            </p>
                        </a>
                    ))}
                </div>

                <div className="mt-8 rounded-xl border border-white/10 bg-[#1A1E1A] p-5">
                    <p className="text-sm text-gray-400">
                        Conta conectada
                    </p>

                    <p className="mt-2 font-medium">
                        {usuario.email}
                    </p>

                    <p className="mt-1 text-sm text-gray-400">
                        Perfil: {usuario.perfil}
                    </p>
                </div>
            </section>
        </main>
    );
}