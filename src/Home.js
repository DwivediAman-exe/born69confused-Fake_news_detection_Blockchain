import { useState, useEffect } from 'react';
import * as IPFS from 'ipfs-core';
import { Web3Storage } from 'web3.storage';
import { ethers } from 'ethers';
import { Row, Form, Button, Card, ListGroup } from 'react-bootstrap';
// import { create as ipfsHttpClient } from 'ipfs-http-client'
// const client = ipfsHttpClient('https://ipfs.infura.io:5001/api/v0')

const Home = ({ contract }) => {
	const [posts, setPosts] = useState('');
	const [ipfs, setIPFS] = useState(null);
	const [hasProfile, setHasProfile] = useState(false);
	const [post, setPost] = useState('');
	const [address, setAddress] = useState('');
	const [loading, setLoading] = useState(true);
	const loadPosts = async () => {
		// Get user's address
		let address = await contract.signer.getAddress();
		setAddress(address);
		// Check if user owns an nft
		// and if they do set profile to true
		const balance = await contract.balanceOf(address);
		setHasProfile(() => balance > 0);
		// Get all posts
		let results = await contract.getAllPosts();
		// Fetch metadata of each post and add that to post object.
		let posts = await Promise.all(
			results.map(async (i, index) => {
				console.log(i);
				let response;
				// use hash to fetch the post's metadata stored on ipfs

				response = await fetch(`https://${i.hash}.ipfs.w3s.link`);
				console.log(response);

				const metadataPost = await response?.json();
				// get authors nft profile
				const nftId = await contract.profiles(i.author);
				// get uri url of nft profile
				const uri = await contract.tokenURI(nftId);
				// fetch nft profile metadata
				response = await fetch(uri);
				const metadataProfile = await response.json();
				// define author object
				const author = {
					address: i.author,
					username: metadataProfile.username,
					avatar: metadataProfile.avatar,
				};
				// define post object
				let post = {
					id: i.id,
					content: metadataPost?.post,
					tipAmount: i.tipAmount,
					author,
				};
				console.log(post);
				return post;
			})
		);
		posts = posts.sort((a, b) => b.tipAmount - a.tipAmount);
		// Sort posts from most tipped to least tipped.
		setPosts(posts);
		setLoading(false);
	};

	function getAccessToken() {
		console.log(process.env.REACT_APP_WEB3STORAGE_TOKEN);
		return process.env.REACT_APP_WEB3STORAGE_TOKEN;
	}

	function makeStorageClient() {
		return new Web3Storage({ token: getAccessToken() });
	}

	useEffect(() => {
		const createIPFS = async () => {
			const client = makeStorageClient();
			setIPFS(client);
		};
		if (!ipfs) createIPFS();
		if (!posts) {
			loadPosts();
		}
	});
	const uploadPost = async () => {
		if (!post) return;
		let hash;
		// Upload post to IPFS
		try {
			const file = new File([JSON.stringify({ post })], 'new_file');
			const path = await ipfs.put([file], {
				wrapWithDirectory: false,
			});

			setLoading(true);
			hash = path;
		} catch (error) {
			console.log('ipfs image upload error: ', error);
		}
		// upload post to blockchain
		await (await contract.uploadPost(hash)).wait();
		loadPosts();
	};
	const tip = async (post) => {
		// tip post owner
		await (
			await contract.tipPostOwner(post.id, {
				value: ethers.utils.parseEther('0.1'),
			})
		).wait();
		loadPosts();
	};
	if (loading)
		return (
			<div className="text-center">
				<main style={{ padding: '1rem 0' }}>
					<h2>Loading...</h2>
				</main>
			</div>
		);
	return (
		<div className="container-fluid mt-5">
			{hasProfile ? (
				<div className="row">
					<main
						role="main"
						className="col-12 mx-auto"
						style={{ maxWidth: '1000px' }}
					>
						<div className="content mx-auto">
							<Row className="g-4">
								<Form.Control
									onChange={(e) => setPost(e.target.value)}
									size="lg"
									required
									as="textarea"
									placeholder="Have some news to share?"
								/>
								<div className="d-grid px-0">
									<Button
										onClick={uploadPost}
										variant="primary"
										size="lg"
									>
										Post!
									</Button>
								</div>
							</Row>
						</div>
					</main>
				</div>
			) : (
				<div className="text-center">
					<main style={{ padding: '1rem 0' }}>
						<h2>Must own an NFT to post</h2>
					</main>
				</div>
			)}

			<p>&nbsp;</p>
			<hr />
			<p className="my-auto">&nbsp;</p>
			{posts.length > 0 ? (
				posts.map((post, key) => {
					console.log(address === post.author.address || !hasProfile);
					return (
						<div
							key={key}
							className="col-lg-12 my-3 mx-auto"
							style={{ width: '1000px' }}
						>
							<Card border="primary">
								<Card.Header>
									<img
										className="mr-2"
										width="30"
										height="30"
										src={post.author.avatar}
									/>
									<small className="ms-2 me-auto d-inline">
										{post.author.username}
									</small>
									<small className="mt-1 float-end d-inline">
										{post.author.address}
									</small>
								</Card.Header>
								<Card.Body color="secondary">
									<Card.Title>{post.content}</Card.Title>
								</Card.Body>
								<Card.Footer className="list-group-item">
									<div className="d-inline mt-auto float-start">
										Votes:{' '}
										{ethers.utils.formatEther(
											post.tipAmount
										)}{' '}
										ETH
									</div>
									{address === post.author.address ||
									!hasProfile ? null : (
										<div className="d-inline float-end">
											<Button
												onClick={() => tip(post)}
												className="px-0 py-0 font-size-16"
												variant="link"
												size="md"
											>
												Tip for 0.1 ETH
											</Button>
										</div>
									)}
								</Card.Footer>
							</Card>
						</div>
					);
				})
			) : (
				<div className="text-center">
					<main style={{ padding: '1rem 0' }}>
						<h2>No posts yet</h2>
					</main>
				</div>
			)}
		</div>
	);
};

export default Home;
